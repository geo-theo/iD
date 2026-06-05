import http from 'node:http';
import path from 'node:path';
import { glob, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { styleText } from 'node:util';
import { watch } from 'chokidar';
import serve from 'serve-handler';
import { buildCSS } from './build_css.js';

const port = 8080;
const projectsRoot = path.resolve('../datasets');

function projectFolderName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function assertProjectFolder(folder) {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(folder || '')) {
    throw Object.assign(new Error('Invalid dataset folder'), { statusCode: 400 });
  }
  return folder;
}

function projectPath(folder, filename = '') {
  const safeFolder = assertProjectFolder(folder);
  const resolved = path.resolve(projectsRoot, safeFolder, filename);
  const projectRootWithSeparator = path.resolve(projectsRoot, safeFolder) + path.sep;

  if (filename && !resolved.startsWith(projectRootWithSeparator)) {
    throw Object.assign(new Error('Invalid dataset path'), { statusCode: 400 });
  }
  return resolved;
}

async function readJSON(filename, fallback) {
  try {
    return JSON.parse(await readFile(filename, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJSON(filename, data) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function readRequestJSON(request) {
  const chunks = [];
  let length = 0;

  for await (const chunk of request) {
    length += chunk.length;
    if (length > 25 * 1024 * 1024) {
      throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJSON(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  response.end(JSON.stringify(data, null, 2));
}

function sendGeoJSON(response, folder, featureCollection) {
  response.writeHead(200, {
    'Content-Type': 'application/geo+json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${folder}.geojson"`,
    'Cache-Control': 'no-cache'
  });
  response.end(JSON.stringify(featureCollection, null, 2));
}

function emptyFeatureCollection(metadata) {
  return {
    type: 'FeatureCollection',
    name: metadata.name,
    metadata: {
      project: metadata.name,
      projectFolder: metadata.folder,
      dataset: metadata.name,
      datasetFolder: metadata.folder,
      imageryTimestamp: metadata.imageryTimestamp || '',
      imageryCRS: metadata.crs || '',
      imagerySourceType: metadata.imagerySourceType || '',
      waybackReleaseNum: metadata.waybackReleaseNum || '',
      waybackReleaseDate: metadata.waybackReleaseDate || '',
      waybackLayerID: metadata.waybackLayerID || '',
      waybackTileURL: metadata.waybackTileURL || '',
      customTileURL: metadata.customTileURL || ''
    },
    features: []
  };
}

async function listProjects() {
  await mkdir(projectsRoot, { recursive: true });
  const entries = await readdir(projectsRoot, { withFileTypes: true });

  const projectReads = entries
    .filter(entry => entry.isDirectory() && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(entry.name))
    .map(entry => {
      const folder = entry.name;
      const metadataPath = projectPath(folder, 'metadata.json');
      return readJSON(metadataPath, null);
    });

  const projects = (await Promise.all(projectReads)).filter(Boolean);
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

async function createProject(data) {
  const now = new Date().toISOString();
  const name = String(data.name || '').trim();
  const folder = projectFolderName(data.folder || name);

  if (!name || !folder) {
    throw Object.assign(new Error('Dataset name is required'), { statusCode: 400 });
  }

  const root = projectPath(folder);
  await mkdir(root, { recursive: true });

  const metadataPath = path.join(root, 'metadata.json');
  const existing = await readJSON(metadataPath, null);
  const metadata = {
    name,
    folder,
    imagerySourceType: data.imagerySourceType || existing?.imagerySourceType || 'custom',
    imageryTimestamp: data.imageryTimestamp || existing?.imageryTimestamp || '',
    crs: data.crs || existing?.crs || 'EPSG:3857',
    waybackReleaseNum: data.waybackReleaseNum || existing?.waybackReleaseNum || '',
    waybackReleaseDate: data.waybackReleaseDate || existing?.waybackReleaseDate || '',
    waybackLayerID: data.waybackLayerID || existing?.waybackLayerID || '',
    waybackTileURL: data.waybackTileURL || existing?.waybackTileURL || '',
    customTileURL: data.customTileURL || existing?.customTileURL || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  await writeJSON(metadataPath, metadata);

  const featuresPath = path.join(root, 'features.geojson');
  const existingFeatures = await readJSON(featuresPath, null);
  if (!existingFeatures) {
    await writeJSON(featuresPath, emptyFeatureCollection(metadata));
  }

  return metadata;
}

async function updateProject(folder, data) {
  const metadataPath = projectPath(folder, 'metadata.json');
  const existing = await readJSON(metadataPath, null);
  if (!existing) {
    throw Object.assign(new Error('Dataset not found'), { statusCode: 404 });
  }

  const metadata = {
    ...existing,
    name: data.name || existing.name,
    imagerySourceType: data.imagerySourceType ?? existing.imagerySourceType ?? 'custom',
    imageryTimestamp: data.imageryTimestamp ?? existing.imageryTimestamp ?? '',
    crs: data.crs ?? existing.crs ?? 'EPSG:3857',
    waybackReleaseNum: data.waybackReleaseNum ?? existing.waybackReleaseNum ?? '',
    waybackReleaseDate: data.waybackReleaseDate ?? existing.waybackReleaseDate ?? '',
    waybackLayerID: data.waybackLayerID ?? existing.waybackLayerID ?? '',
    waybackTileURL: data.waybackTileURL ?? existing.waybackTileURL ?? '',
    customTileURL: data.customTileURL ?? existing.customTileURL ?? '',
    updatedAt: new Date().toISOString()
  };

  await writeJSON(metadataPath, metadata);
  return metadata;
}

async function handleHeritageAPI(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const pathname = url.pathname;

  if (pathname === '/heritage/api/projects' && request.method === 'GET') {
    return sendJSON(response, 200, { projects: await listProjects(), projectsRoot });
  }

  if (pathname === '/heritage/api/projects' && request.method === 'POST') {
    const metadata = await createProject(await readRequestJSON(request));
    return sendJSON(response, 201, { project: metadata, projectsRoot });
  }

  const match = pathname.match(/^\/heritage\/api\/projects\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return false;

  const folder = assertProjectFolder(decodeURIComponent(match[1]));
  const resource = match[2] || 'metadata';

  if (request.method === 'GET' && resource === 'metadata') {
    const metadata = await readJSON(projectPath(folder, 'metadata.json'), null);
    if (!metadata) throw Object.assign(new Error('Dataset not found'), { statusCode: 404 });
    return sendJSON(response, 200, { project: metadata, projectsRoot });
  }

  if (request.method === 'PUT' && resource === 'metadata') {
    const metadata = await updateProject(folder, await readRequestJSON(request));
    return sendJSON(response, 200, { project: metadata, projectsRoot });
  }

  if (request.method === 'GET' && (resource === 'features' || resource === 'export.geojson')) {
    const metadata = await readJSON(projectPath(folder, 'metadata.json'), null);
    if (!metadata) throw Object.assign(new Error('Dataset not found'), { statusCode: 404 });
    const features = await readJSON(projectPath(folder, 'features.geojson'), emptyFeatureCollection(metadata));
    return resource === 'export.geojson'
      ? sendGeoJSON(response, folder, features)
      : sendJSON(response, 200, features);
  }

  if (request.method === 'PUT' && resource === 'features') {
    const metadata = await readJSON(projectPath(folder, 'metadata.json'), null);
    if (!metadata) throw Object.assign(new Error('Dataset not found'), { statusCode: 404 });

    const features = await readRequestJSON(request);
    if (features.type !== 'FeatureCollection' || !Array.isArray(features.features)) {
      throw Object.assign(new Error('Expected a GeoJSON FeatureCollection'), { statusCode: 400 });
    }

    features.name = metadata.name;
    features.metadata = {
      ...(features.metadata || {}),
      project: metadata.name,
      projectFolder: metadata.folder,
      dataset: metadata.name,
      datasetFolder: metadata.folder,
      imageryTimestamp: metadata.imageryTimestamp || '',
      imageryCRS: metadata.crs || '',
      imagerySourceType: metadata.imagerySourceType || '',
      waybackReleaseNum: metadata.waybackReleaseNum || '',
      waybackReleaseDate: metadata.waybackReleaseDate || '',
      waybackLayerID: metadata.waybackLayerID || '',
      waybackTileURL: metadata.waybackTileURL || '',
      customTileURL: metadata.customTileURL || '',
      updatedAt: new Date().toISOString()
    };

    await writeJSON(projectPath(folder, 'features.geojson'), features);
    return sendJSON(response, 200, { ok: true, featureCount: features.features.length });
  }

  response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Method not allowed' }));
  return true;
}

watch(
  await Array.fromAsync(glob('css/**/*.css')), {
  ignoreInitial: false
}).on('all', () => {
  buildCSS();
});

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/heritage/api/')) {
    handleHeritageAPI(request, response)
      .then(handled => {
        if (handled === false) {
          response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ error: 'Not found' }));
        }
      })
      .catch(err => {
        const statusCode = err.statusCode || 500;
        response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: err.message || 'Server error' }));
      });
    return;
  }

  return serve(request, response, {
    cleanUrls: false,
    rewrites: [{
      source: '/',
      destination: '/index.html'
    }],
    symlinks: true,
    headers: [{
      source: '**',
      headers: [{
        key : 'Cache-Control',
        value : 'no-cache'
      }]
    }]
  });
});

server.listen(port, () => {
  /* eslint-disable no-console */
  console.log(styleText('yellow', `Listening on ${port}`));
});
