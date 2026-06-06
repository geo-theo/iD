import { select as d3_select } from 'd3-selection';

import { svgIcon } from '../../svg/icon';
import { uiTooltip } from '../tooltip';


export function uiToolHeritageProject(context) {
    const tool = {
        id: 'heritage_project',
        label: selection => selection.text('Dataset')
    };

    let button = null;
    let tooltipBehavior = null;
    let statusMessage = '';
    let statusType = '';
    const roadFeatureKeys = ['traffic_roads', 'service_roads', 'paths'];
    const featureFocusPresets = [
        { id: 'all', label: 'All', keys: null, message: 'Showing all OSM feature types.' },
        { id: 'buildings', label: 'Buildings', keys: ['buildings', 'building_parts'], message: 'Showing buildings and building parts only.' },
        { id: 'roads', label: 'Roads', keys: roadFeatureKeys, message: 'Showing roads and paths only.' },
        { id: 'pois', label: 'POIs', keys: ['points', 'address_points'], message: 'Showing POIs and address points only.' },
        { id: 'land-water', label: 'Land/Water', keys: ['landuse', 'water'], message: 'Showing landuse and water only.' },
        { id: 'boundaries', label: 'Boundaries', keys: ['boundaries'], message: 'Showing boundaries only.' }
    ];


    function manager() {
        return context.heritageProject();
    }


    function setStatus(message, type = '') {
        statusMessage = message || '';
        statusType = type;
        context.container()
            .selectAll('.heritage-project-status')
            .attr('data-status', statusType)
            .text(statusMessage);
    }


    function updateButtonState() {
        if (!button) return;

        const activeProject = manager().activeProject();
        button
            .classed('active', !!activeProject);

        if (tooltipBehavior) {
            tooltipBehavior
                .title(() => selection => selection.text(activeProject ? activeProject.name : 'Open dataset'));
        }
    }


    async function withStatus(action, successMessage) {
        try {
            const result = await action();
            const message = typeof successMessage === 'function' ? successMessage(result) : successMessage;
            setStatus(message, 'success');
            renderPanel();
            return result;
        } catch (err) {
            setStatus(err.message || 'Dataset action failed', 'error');
            return null;
        }
    }


    function valuesFromPanel(panel) {
        const activeProject = manager().activeProject();
        return {
            name: panel.select('.heritage-project-name').property('value').trim(),
            imagerySourceType: activeProject && activeProject.imagerySourceType || 'custom',
            imageryTimestamp: panel.select('.heritage-project-timestamp').property('value').trim(),
            crs: panel.select('.heritage-project-crs').property('value').trim() || 'EPSG:3857',
            customTileURL: panel.select('.heritage-project-tile-url').property('value').trim()
        };
    }


    function applyFeatureFocus(preset) {
        if (!preset.keys) {
            context.features().enableAll();
        } else {
            context.features().disableAll();
            preset.keys.forEach(key => context.features().enable(key));
        }
        setStatus(preset.message, 'success');
    }


    function closePanel() {
        context.container()
            .selectAll('.heritage-project-panel-wrap')
            .remove();
    }


    function openPanel(d3_event) {
        if (d3_event) d3_event.preventDefault();

        manager().loadProjects()
            .then(() => {
                statusMessage = '';
                statusType = '';
                renderPanel();
            })
            .catch(err => {
                statusMessage = err.message || 'Could not load datasets';
                statusType = 'error';
                renderPanel();
            });
    }


    function renderPanel() {
        const heritage = manager();
        const activeProject = heritage.activeProject();
        const projects = heritage.projects();
        const waybackItems = heritage.waybackItems();

        let wrap = context.container()
            .selectAll('.heritage-project-panel-wrap')
            .data([0]);

        const wrapEnter = wrap.enter()
            .append('div')
            .attr('class', 'heritage-project-panel-wrap');

        const panelEnter = wrapEnter
            .append('div')
            .attr('class', 'heritage-project-panel');

        const header = panelEnter
            .append('div')
            .attr('class', 'header fillL');

        header
            .append('h2')
            .text('Dataset Export');

        header
            .append('button')
            .attr('class', 'close')
            .attr('title', 'Close')
            .on('click', closePanel)
            .call(svgIcon('#iD-icon-close'));

        const body = panelEnter
            .append('div')
            .attr('class', 'body fillL');

        body
            .append('div')
            .attr('class', 'heritage-project-status');

        const active = body
            .append('div')
            .attr('class', 'heritage-project-active');

        active
            .append('strong')
            .text('Active dataset');

        active
            .append('span');

        const existing = body
            .append('label')
            .attr('class', 'heritage-project-field');

        existing
            .append('span')
            .text('Open dataset');

        existing
            .append('select')
            .attr('class', 'heritage-project-select')
            .on('change', function() {
                const folder = d3_select(this).property('value');
                if (!folder) return;
                withStatus(
                    () => heritage.setActiveProject(folder),
                    'Dataset opened.'
                );
            });

        [
            ['Dataset name', 'heritage-project-name', 'text', 'Timbuktu 2012'],
            ['Imagery timestamp', 'heritage-project-timestamp', 'text', '2012-06-30 or 2012-06-28/2012-06-30'],
            ['Imagery CRS', 'heritage-project-crs', 'text', 'EPSG:3857']
        ].forEach(([label, klass, type, placeholder]) => {
            const field = body
                .append('label')
                .attr('class', 'heritage-project-field');

            field
                .append('span')
                .text(label);

            field
                .append('input')
                .attr('class', klass)
                .attr('type', type)
                .attr('placeholder', placeholder);
        });

        const tileField = body
            .append('label')
            .attr('class', 'heritage-project-field');

        tileField
            .append('span')
            .text('Custom tile or WMS template');

        tileField
            .append('textarea')
            .attr('class', 'heritage-project-tile-url')
            .attr('rows', 3)
            .attr('placeholder', 'https://tiles.example.org/{z}/{x}/{y}.png');

        const waybackField = body
            .append('label')
            .attr('class', 'heritage-project-field');

        waybackField
            .append('span')
            .text('Esri Wayback release');

        waybackField
            .append('select')
            .attr('class', 'heritage-wayback-select');

        const waybackButtons = body
            .append('div')
            .attr('class', 'buttons fillL heritage-project-buttons heritage-wayback-buttons');

        waybackButtons
            .append('button')
            .attr('class', 'secondary-action button heritage-load-wayback-local')
            .text('Load Local Wayback Dates');

        waybackButtons
            .append('button')
            .attr('class', 'secondary-action button heritage-load-wayback-all')
            .text('Load All Wayback Dates');

        waybackButtons
            .append('button')
            .attr('class', 'action button heritage-apply-wayback')
            .text('Use Wayback');

        waybackButtons
            .append('button')
            .attr('class', 'secondary-action button heritage-use-custom')
            .text('Use Custom Tiles');

        const filterButtons = body
            .append('div')
            .attr('class', 'buttons fillL heritage-project-buttons heritage-filter-buttons');

        featureFocusPresets.forEach(preset => {
            filterButtons
                .append('button')
                .datum(preset)
                .attr('class', `secondary-action button heritage-feature-focus heritage-feature-focus-${preset.id}`)
                .attr('data-focus', preset.id)
                .text(preset.label);
        });

        const buttons = body
            .append('div')
            .attr('class', 'buttons fillL heritage-project-buttons');

        buttons
            .append('button')
            .attr('class', 'action button heritage-create-project')
            .text('Create Dataset');

        buttons
            .append('button')
            .attr('class', 'secondary-action button heritage-update-project')
            .text('Update Dataset');

        buttons
            .append('button')
            .attr('class', 'secondary-action button heritage-save-project')
            .text('Save');

        buttons
            .append('button')
            .attr('class', 'secondary-action button heritage-destroyed')
            .text('Mark Destroyed');

        buttons
            .append('a')
            .attr('class', 'secondary-action button heritage-export-project')
            .attr('target', '_blank')
            .text('Export GeoJSON');

        wrap = wrapEnter.merge(wrap);

        const panel = wrap.select('.heritage-project-panel');

        panel
            .select('.heritage-project-status')
            .attr('data-status', statusType)
            .text(statusMessage);

        panel
            .select('.heritage-project-active span')
            .text(activeProject ? ` ${activeProject.name}` : ' none');

        const options = panel.select('.heritage-project-select')
            .selectAll('option')
            .data([{ folder: '', name: 'Select a dataset' }].concat(projects), d => d.folder);

        options.exit()
            .remove();

        options.enter()
            .append('option')
            .merge(options)
            .attr('value', d => d.folder)
            .text(d => d.name);

        panel.select('.heritage-project-select')
            .property('value', activeProject ? activeProject.folder : '');

        panel.select('.heritage-project-name')
            .property('value', activeProject ? activeProject.name : '');

        panel.select('.heritage-project-timestamp')
            .property('value', activeProject ? activeProject.imageryTimestamp || '' : '');

        panel.select('.heritage-project-crs')
            .property('value', activeProject ? activeProject.crs || 'EPSG:3857' : 'EPSG:3857');

        panel.select('.heritage-project-tile-url')
            .property('value', activeProject ? activeProject.customTileURL || '' : '');

        const waybackOptions = panel.select('.heritage-wayback-select')
            .selectAll('option')
            .data(
                [{ releaseNum: '', releaseDateLabel: waybackItems.length ? 'Select a Wayback release' : 'Load Wayback dates first' }].concat(waybackItems),
                d => d.releaseNum
            );

        waybackOptions.exit()
            .remove();

        waybackOptions.enter()
            .append('option')
            .merge(waybackOptions)
            .attr('value', d => d.releaseNum)
            .text(d => {
                if (!d.releaseNum) return d.releaseDateLabel;
                return `${d.releaseDateLabel} (${d.layerIdentifier || d.releaseNum})`;
            });

        panel.select('.heritage-wayback-select')
            .property('value', activeProject && activeProject.waybackReleaseNum ? activeProject.waybackReleaseNum : '');

        panel.select('.heritage-create-project')
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                withStatus(
                    () => heritage.createProject(valuesFromPanel(panel)),
                    'Dataset created.'
                );
            });

        panel.select('.heritage-update-project')
            .classed('disabled', !activeProject)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;
                withStatus(
                    () => heritage.updateActiveProject(valuesFromPanel(panel)),
                    'Dataset metadata updated.'
                );
            });

        panel.select('.heritage-load-wayback-local')
            .classed('disabled', !activeProject)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;
                setStatus('Loading Wayback dates near the map center...', '');
                withStatus(
                    () => heritage.loadWaybackItems(),
                    items => `Loaded ${items.length} local Wayback releases.`
                );
            });

        panel.select('.heritage-load-wayback-all')
            .classed('disabled', !activeProject)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;
                setStatus('Loading all Wayback dates...', '');
                withStatus(
                    () => heritage.loadWaybackItems({ allVersions: true }),
                    items => `Loaded ${items.length} Wayback releases.`
                );
            });

        panel.select('.heritage-apply-wayback')
            .classed('disabled', !activeProject || !waybackItems.length)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;

                const releaseNum = panel.select('.heritage-wayback-select').property('value');
                if (!releaseNum) {
                    setStatus('Choose a Wayback release first.', 'error');
                    return;
                }

                withStatus(
                    () => heritage.selectWaybackRelease(releaseNum),
                    project => `Using Esri Wayback ${project.waybackReleaseDate || project.imageryTimestamp}.`
                );
            });

        panel.select('.heritage-use-custom')
            .classed('disabled', !activeProject)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;

                const values = valuesFromPanel(panel);
                withStatus(
                    () => heritage.updateActiveProject({
                        ...values,
                        imagerySourceType: 'custom',
                        waybackReleaseNum: '',
                        waybackReleaseDate: '',
                        waybackLayerID: '',
                        waybackTileURL: ''
                    }),
                    'Using custom tile/WMS imagery.'
                );
            });

        panel.selectAll('.heritage-feature-focus')
            .on('click', function(d3_event, preset) {
                d3_event.preventDefault();
                applyFeatureFocus(preset);
            });

        panel.select('.heritage-save-project')
            .classed('disabled', !activeProject)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;
                withStatus(
                    () => heritage.saveActiveProject(),
                    featureCollection => `Saved ${featureCollection.features.length} features.`
                );
            });

        panel.select('.heritage-destroyed')
            .classed('disabled', !activeProject)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;
                withStatus(
                    async () => {
                        const ids = heritage.markDestroyed();
                        await heritage.saveActiveProject();
                        return ids;
                    },
                    'Selected feature marked destroyed.'
                );
            });

        panel.select('.heritage-export-project')
            .classed('disabled', !activeProject)
            .attr('href', activeProject ? heritage.exportURL() : '#')
            .attr('download', activeProject ? `${activeProject.folder}.geojson` : null)
            .on('click', function(d3_event) {
                if (!activeProject) d3_event.preventDefault();
            });

        updateButtonState();
    }


    tool.render = function(selection) {
        tooltipBehavior = uiTooltip()
            .placement('bottom')
            .title(() => selection => selection.text('Open dataset'))
            .scrollContainer(context.container().select('.top-toolbar'));

        button = selection
            .append('button')
            .attr('class', 'heritage-project bar-button')
            .on('click', openPanel)
            .call(tooltipBehavior);

        button
            .call(svgIcon('#iD-icon-data'));

        manager()
            .on('change.heritageProjectTool', updateButtonState)
            .on('saved.heritageProjectTool', count => {
                setStatus(`Saved ${count} features.`, 'success');
            })
            .on('error.heritageProjectTool', err => {
                setStatus(err.message || 'Dataset action failed', 'error');
            });

        updateButtonState();
    };


    tool.uninstall = function() {
        manager()
            .on('change.heritageProjectTool', null)
            .on('saved.heritageProjectTool', null)
            .on('error.heritageProjectTool', null);

        button = null;
        tooltipBehavior = null;
    };

    return tool;
}
