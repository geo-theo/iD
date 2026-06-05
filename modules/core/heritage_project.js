import { dispatch as d3_dispatch } from 'd3-dispatch';
import { debounce } from 'es-toolkit/compat';
import { getWaybackItems, getWaybackItemsWithLocalChanges } from '@esri/wayback-core';

import { actionChangeTags } from '../actions/change_tags';
import { prefs } from './preferences';
import { utilRebind } from '../util';


const API_ROOT = '/heritage/api';
const ACTIVE_PROJECT_PREF = 'heritage-active-project';


function cleanObjectID(value) {
    return String(value || '')
        .trim()
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}


function objectIDForEntity(project, entity) {
    return cleanObjectID(entity.tags.objectID) ||
        cleanObjectID(entity.tags['heritage:object_id']) ||
        cleanObjectID(`${project.folder}-${entity.id}`);
}


async function requestJSON(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(json.error || response.statusText || 'Request failed');
    }
    return json;
}


export function coreHeritageProject(context) {
    const dispatch = d3_dispatch('change', 'saved', 'error');
    const heritage = {};

    let _projects = [];
    let _projectsRoot = '';
    let _activeProject = null;
    let _waybackItems = [];
    let _lastFeatureCount = 0;
    let _lastError = null;

    const debouncedSave = debounce(() => {
        if (_activeProject && context.history().hasChanges()) {
            heritage.saveActiveProject().catch(reportError);
        }
    }, 1000);


    function reportError(err) {
        _lastError = err;
        dispatch.call('error', heritage, err);
    }


    function activateProject(project) {
        _activeProject = project;
        prefs(ACTIVE_PROJECT_PREF, project.folder);
        return _activeProject;
    }


    function currentImageryMetadata() {
        const background = context.background();
        const source = background && background.baseLayerSource && background.baseLayerSource();
        const projectTimestamp = _activeProject && _activeProject.imageryTimestamp;

        if (!source) {
            return {
                imageryLayerID: '',
                imagerySource: '',
                imageryTimestamp: projectTimestamp || ''
            };
        }

        const startDate = source.startDate || '';
        const endDate = source.endDate || '';
        let imageryTimestamp = projectTimestamp || '';

        if (!imageryTimestamp && (startDate || endDate)) {
            imageryTimestamp = startDate === endDate ? startDate : [startDate, endDate].filter(Boolean).join('/');
        }

        return {
            imageryLayerID: source.id || '',
            imagerySource: source.imageryUsed && source.imageryUsed() || source.name && source.name() || '',
            imageryTimestamp,
            waybackReleaseNum: source.releaseNum || _activeProject && _activeProject.waybackReleaseNum || '',
            imagerySourceType: source.sourceType || _activeProject && _activeProject.imagerySourceType || ''
        };
    }


    function waybackTemplate(item) {
        return (item.itemURL || '')
            .replace(/\{level\}/g, '{z}')
            .replace(/\{row\}/g, '{y}')
            .replace(/\{col\}/g, '{x}');
    }


    function waybackSourceData(project) {
        if (!project || !project.waybackReleaseNum || !project.waybackTileURL) return null;

        return {
            id: `EsriWayback-${project.waybackReleaseNum}`,
            type: 'wayback',
            name: `Esri Wayback ${project.waybackReleaseDate || project.imageryTimestamp || project.waybackReleaseNum}`,
            template: waybackTemplate({ itemURL: project.waybackTileURL }),
            releaseNum: Number(project.waybackReleaseNum),
            releaseDateLabel: project.waybackReleaseDate || project.imageryTimestamp || '',
            layerIdentifier: project.waybackLayerID || '',
            startDate: project.waybackReleaseDate || project.imageryTimestamp || '',
            endDate: project.waybackReleaseDate || project.imageryTimestamp || '',
            sourceType: 'esri-wayback',
            tileSize: 256,
            zoomExtent: [1, 20]
        };
    }


    function featureForEntity(change) {
        const project = _activeProject;
        if (!project || change.changeType === 'deleted') return null;

        const graph = context.graph();
        const entity = graph.hasEntity(change.entity.id);
        if (!entity || entity.geometry(graph) === 'vertex') return null;

        const geometry = entity.asGeoJSON(graph);
        if (!geometry || geometry.type === 'FeatureCollection') return null;

        const imagery = currentImageryMetadata();
        const objectID = objectIDForEntity(project, entity);
        const properties = {
            ...entity.tags,
            objectID,
            project: project.name,
            projectFolder: project.folder,
            imageryTimestamp: imagery.imageryTimestamp,
            imageryCRS: project.crs || '',
            imagerySource: imagery.imagerySource,
            imageryLayerID: imagery.imageryLayerID,
            imagerySourceType: imagery.imagerySourceType,
            waybackReleaseNum: imagery.waybackReleaseNum,
            idEditorEntityID: entity.id,
            idEditorEntityType: entity.type,
            changeType: change.changeType
        };

        if (entity.tags['heritage:destroyed'] === 'yes' || entity.tags['heritage:status'] === 'destroyed') {
            properties.destroyed = 'yes';
        }

        return {
            type: 'Feature',
            id: objectID,
            properties,
            geometry
        };
    }


    heritage.init = function() {
        context.history()
            .on('change.heritageProject', function() {
                debouncedSave();
            });

        return heritage;
    };


    heritage.projects = () => _projects.slice();
    heritage.projectsRoot = () => _projectsRoot;
    heritage.activeProject = () => _activeProject;
    heritage.waybackItems = () => _waybackItems.slice();
    heritage.lastFeatureCount = () => _lastFeatureCount;
    heritage.lastError = () => _lastError;


    heritage.loadProjects = async function() {
        const result = await requestJSON(`${API_ROOT}/projects`);
        _projects = result.projects || [];
        _projectsRoot = result.projectsRoot || '';

        const storedFolder = prefs(ACTIVE_PROJECT_PREF);
        const storedProject = _projects.find(project => project.folder === storedFolder);
        if (storedProject) activateProject(storedProject);

        dispatch.call('change', heritage);
        return _projects;
    };


    heritage.createProject = async function(attrs) {
        const result = await requestJSON(`${API_ROOT}/projects`, {
            method: 'POST',
            body: JSON.stringify(attrs || {})
        });

        const createdProject = result.project;
        prefs(ACTIVE_PROJECT_PREF, createdProject.folder);
        await heritage.loadProjects();
        activateProject(_projects.find(project => project.folder === createdProject.folder) || createdProject);
        heritage.applyProjectImagery();
        dispatch.call('change', heritage);
        return _activeProject;
    };


    heritage.setActiveProject = async function(folder) {
        const result = await requestJSON(`${API_ROOT}/projects/${encodeURIComponent(folder)}/metadata`);
        activateProject(result.project);
        heritage.applyProjectImagery();
        dispatch.call('change', heritage);
        return _activeProject;
    };


    heritage.updateActiveProject = async function(attrs) {
        if (!_activeProject) {
            throw new Error('Create or open a project first.');
        }

        const folder = _activeProject.folder;
        const result = await requestJSON(`${API_ROOT}/projects/${encodeURIComponent(folder)}/metadata`, {
            method: 'PUT',
            body: JSON.stringify(attrs || {})
        });

        const updatedProject = result.project;
        activateProject(updatedProject);
        _projects = _projects.map(project => project.folder === updatedProject.folder ? updatedProject : project);
        heritage.applyProjectImagery();
        dispatch.call('change', heritage);
        return _activeProject;
    };


    heritage.applyProjectImagery = function() {
        if (!_activeProject) return heritage;

        if (_activeProject.imagerySourceType === 'esri-wayback') {
            return heritage.applyWaybackImagery();
        }

        return heritage.applyCustomImagery();
    };


    heritage.applyCustomImagery = function() {
        if (!_activeProject || !_activeProject.customTileURL) return heritage;
        const background = context.background();
        const customSource = background && background.findSource && background.findSource('custom');
        if (!customSource) return heritage;

        customSource.template(_activeProject.customTileURL);
        prefs('background-custom-template', _activeProject.customTileURL);
        prefs('background-last-used', 'custom');
        background.baseLayerSource(customSource);
        return heritage;
    };


    heritage.applyWaybackImagery = function() {
        const data = waybackSourceData(_activeProject);
        if (!data) return heritage;

        const background = context.background();
        if (!background || !background.addSource) return heritage;

        const source = background.addSource(data);
        if (!source) return heritage;

        prefs('background-last-used', source.id);
        background.baseLayerSource(source);
        return heritage;
    };


    heritage.loadWaybackItems = async function(options = {}) {
        const map = context.map();
        const center = options.center || map.center();
        const zoom = Math.max(1, Math.min(20, Math.round(options.zoom || map.zoom() || 15)));
        const point = {
            longitude: center[0],
            latitude: center[1]
        };

        _waybackItems = options.allVersions ?
            await getWaybackItems() :
            await getWaybackItemsWithLocalChanges(point, zoom);

        dispatch.call('change', heritage);
        return _waybackItems;
    };


    heritage.selectWaybackRelease = async function(releaseNum) {
        if (!_activeProject) {
            throw new Error('Create or open a project first.');
        }

        let item = _waybackItems.find(d => String(d.releaseNum) === String(releaseNum));
        if (!item) {
            const allItems = await getWaybackItems();
            item = allItems.find(d => String(d.releaseNum) === String(releaseNum));
        }
        if (!item) {
            throw new Error('Wayback release not found.');
        }

        const project = await heritage.updateActiveProject({
            imagerySourceType: 'esri-wayback',
            imageryTimestamp: item.releaseDateLabel,
            crs: 'EPSG:3857',
            waybackReleaseNum: item.releaseNum,
            waybackReleaseDate: item.releaseDateLabel,
            waybackLayerID: item.layerIdentifier,
            waybackTileURL: item.itemURL
        });

        heritage.applyWaybackImagery();
        return project;
    };


    heritage.toGeoJSON = function() {
        const project = _activeProject;
        if (!project) {
            throw new Error('Create or open a project first.');
        }

        const summary = context.history().difference().summary();
        const features = summary
            .map(featureForEntity)
            .filter(Boolean);

        _lastFeatureCount = features.length;

        return {
            type: 'FeatureCollection',
            name: project.name,
            metadata: {
                project: project.name,
                projectFolder: project.folder,
                imageryTimestamp: project.imageryTimestamp || '',
                imageryCRS: project.crs || '',
                imagerySourceType: project.imagerySourceType || '',
                waybackReleaseNum: project.waybackReleaseNum || '',
                waybackReleaseDate: project.waybackReleaseDate || '',
                waybackLayerID: project.waybackLayerID || '',
                waybackTileURL: project.waybackTileURL || '',
                customTileURL: project.customTileURL || '',
                generatedAt: new Date().toISOString()
            },
            features
        };
    };


    heritage.saveActiveProject = async function() {
        const project = _activeProject;
        if (!project) {
            throw new Error('Create or open a project first.');
        }

        const featureCollection = heritage.toGeoJSON();
        const result = await requestJSON(`${API_ROOT}/projects/${encodeURIComponent(project.folder)}/features`, {
            method: 'PUT',
            body: JSON.stringify(featureCollection)
        });

        _lastFeatureCount = result.featureCount || featureCollection.features.length;
        _lastError = null;
        dispatch.call('saved', heritage, _lastFeatureCount);
        dispatch.call('change', heritage);
        return featureCollection;
    };


    heritage.exportURL = function() {
        if (!_activeProject) return '#';
        return `${API_ROOT}/projects/${encodeURIComponent(_activeProject.folder)}/export.geojson`;
    };


    heritage.markDestroyed = function(entityIDs) {
        const graph = context.graph();
        const ids = (entityIDs || context.selectedIDs())
            .map(id => graph.hasEntity(id))
            .filter(entity => entity && entity.geometry(graph) !== 'vertex')
            .map(entity => entity.id);

        if (!ids.length) {
            throw new Error('Select a line or polygon first.');
        }

        const actions = ids.map(id => {
            const entity = graph.entity(id);
            return actionChangeTags(id, {
                ...entity.tags,
                'heritage:destroyed': 'yes',
                'heritage:status': 'destroyed'
            });
        });

        actions.push('Marked selected feature as destroyed');
        context.perform(...actions);
        return ids;
    };


    heritage.reset = function() {
        debouncedSave.cancel();
        return heritage;
    };


    return utilRebind(heritage, dispatch, 'on');
}
