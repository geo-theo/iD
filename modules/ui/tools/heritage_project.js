import { select as d3_select } from 'd3-selection';

import { svgIcon } from '../../svg/icon';
import { uiTooltip } from '../tooltip';


export function uiToolHeritageProject(context) {
    const tool = {
        id: 'heritage_project',
        label: selection => selection.text('Project')
    };

    let button = null;
    let tooltipBehavior = null;
    let statusMessage = '';
    let statusType = '';


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
                .title(() => selection => selection.text(activeProject ? activeProject.name : 'Open research project'));
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
            setStatus(err.message || 'Project action failed', 'error');
            return null;
        }
    }


    function valuesFromPanel(panel) {
        return {
            name: panel.select('.heritage-project-name').property('value').trim(),
            imageryTimestamp: panel.select('.heritage-project-timestamp').property('value').trim(),
            crs: panel.select('.heritage-project-crs').property('value').trim() || 'EPSG:3857',
            customTileURL: panel.select('.heritage-project-tile-url').property('value').trim()
        };
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
                statusMessage = err.message || 'Could not load projects';
                statusType = 'error';
                renderPanel();
            });
    }


    function renderPanel() {
        const heritage = manager();
        const activeProject = heritage.activeProject();
        const projects = heritage.projects();

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
            .text('Research Project');

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
            .text('Active project');

        active
            .append('span');

        const existing = body
            .append('label')
            .attr('class', 'heritage-project-field');

        existing
            .append('span')
            .text('Open project');

        existing
            .append('select')
            .attr('class', 'heritage-project-select')
            .on('change', function() {
                const folder = d3_select(this).property('value');
                if (!folder) return;
                withStatus(
                    () => heritage.setActiveProject(folder),
                    'Project opened.'
                );
            });

        [
            ['Project name', 'heritage-project-name', 'text', 'Timbuktu June 2012'],
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

        const buttons = body
            .append('div')
            .attr('class', 'buttons fillL heritage-project-buttons');

        buttons
            .append('button')
            .attr('class', 'action button heritage-create-project')
            .text('Create');

        buttons
            .append('button')
            .attr('class', 'secondary-action button heritage-update-project')
            .text('Update Metadata');

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
            .data([{ folder: '', name: 'Select a project' }].concat(projects), d => d.folder);

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

        panel.select('.heritage-create-project')
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                withStatus(
                    () => heritage.createProject(valuesFromPanel(panel)),
                    'Project created.'
                );
            });

        panel.select('.heritage-update-project')
            .classed('disabled', !activeProject)
            .on('click', function(d3_event) {
                d3_event.preventDefault();
                if (!activeProject) return;
                withStatus(
                    () => heritage.updateActiveProject(valuesFromPanel(panel)),
                    'Project metadata updated.'
                );
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
            .title(() => selection => selection.text('Open research project'))
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
                setStatus(err.message || 'Project action failed', 'error');
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
