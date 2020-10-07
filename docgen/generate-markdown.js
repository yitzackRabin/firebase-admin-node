const yaml = require('js-yaml');
const fs = require('mz/fs');
const path = require('path');

const { exec } = require('child-process-promise');

const REPO_ROOT = path.resolve(`${__dirname}/..`);
const API_REPORT_TEMP_DIR = path.resolve(REPO_ROOT, 'temp');
const API_REPORT_JSON = path.resolve(API_REPORT_TEMP_DIR, 'firebase-admin.api.json');
const MARKDOWN_DIR = path.resolve(REPO_ROOT, 'docgen', 'markdown');

const HEADER = `{% extends "_internal/templates/reference.html" %}
{% block title %}firebase-admin{% endblock title %}

{% block body %}`;

const FOOTER = `{% endblock body %}`;

const API_DOC_COMMAND = `${REPO_ROOT}/node_modules/.bin/api-documenter markdown \
  -i ${API_REPORT_TEMP_DIR} \
  -o ${MARKDOWN_DIR}`;


async function generateToc() {
  const report = require(API_REPORT_JSON);
  const entryPoint = report.members[0];
  const namespaces = [];
  const toc = [];

  const overrides = {
    database: [
      {
        title: 'Database',
        path: '/docs/reference/admin/node/firebase-admin.database.database',
      },
    ],
  };

  const admin = {
    title: 'admin',
    path: '/docs/reference/admin/node/firebase-admin',
    section: [],
  };

  entryPoint.members.forEach((member) => {
    if (member.kind === 'Namespace') {
      namespaces.push(member);
    } else {
      admin.section.push({
        title: member.name,
        path: `/docs/reference/admin/node/firebase-admin.${member.name.toLowerCase()}`
      })
    }
  });
  toc.push(admin);

  namespaces.forEach((ns) => {
    const child = {
      title: `admin.${ns.name}`,
      path: `/docs/reference/admin/node/firebase-admin.${ns.name}`,
      section: [],
    };
    ns.members.forEach((member) => {
      if (member.kind !== 'Variable') {
        child.section.push({
          title: member.name,
          path: `/docs/reference/admin/node/firebase-admin.${ns.name}.${member.name.toLowerCase()}`
        });
      }
    });
    const other = overrides[ns.name];
    if (other) {
      child.section.push(...other);
    }
    if (child.section.length === 0) {
      delete child.section;
    }
    toc.push(child);
  });

  await fs.writeFile(path.resolve(MARKDOWN_DIR, '_toc.yaml'), yaml.dump({toc}));
}

async function generateTempHomeMdFile() {
  const homeRaw = await fs.readFile(path.resolve(REPO_ROOT, 'docgen', 'content-sources', 'node', 'HOME.md'));
  const tocRaw = await fs.readFile(path.resolve(MARKDOWN_DIR, '_toc.yaml'));
  const { toc } = yaml.safeLoad(tocRaw);
  let tocPageLines = [homeRaw, '# API Reference'];
  toc.forEach(group => {
    tocPageLines.push(`\n## [${group.title}](${stripPath(group.path)})`);
    const section = group.section || [];
    section.forEach(item => {
      tocPageLines.push(`- [${item.title}](${stripPath(item.path)}.md)`);
    });
  });
  const tempHomePath = path.resolve(MARKDOWN_DIR, 'index.md');
  return fs.writeFile(tempHomePath, tocPageLines.join('\n'));
}

function stripPath(path) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

async function enrichTypeAliases() {
  const report = require(API_REPORT_JSON);
  const entryPoint = report.members[0];
  const namespaces = [];
  entryPoint.members.forEach((member) => {
    if (member.kind === 'Namespace') {
      namespaces.push(member);
    }
  });

  namespaces.forEach((ns) => {
    ns.members.forEach((member) => {
      if (member.kind === 'TypeAlias') {
        const aliasFile = canonicalReferenceToFileName(member.canonicalReference);
        console.log('Type alias: ', aliasFile);
        const refs = [];
        member.excerptTokens.forEach((token) => {
          if (token.kind === 'Reference') {
            refs.push({
              name: token.text,
              path: canonicalReferenceToFileName(token.canonicalReference),
            });
          }
        });

        if (refs.length > 0) {
          const aliasPath = path.resolve(MARKDOWN_DIR, aliasFile);
          const content = fs.readFileSync(aliasPath);
          fs.writeFileSync(aliasPath, Buffer.concat([content, generateAliasTable(refs)]));
        }
      }
    });
  });
}

function canonicalReferenceToFileName(ref) {
  const name = ref.toLowerCase().replace('!', '.').split(':')[0];
  return `${name}.md`;
}

function generateAliasTable(refs) {
  let table = '\n### Referenced types\n\n';
  refs.forEach((ref) => {
    table += `* [${ref.name}](./${ref.path})\n`;
  });
  return Buffer.from(table);
}

async function copyOverrides() {
  const overrides = path.resolve(REPO_ROOT, 'docgen', 'overrides')
  const children = await fs.readdir(overrides);
  await Promise.all(children.map(
    (child) => fs.copyFile(path.resolve(overrides, child), path.resolve(MARKDOWN_DIR, child))));
}

async function addFormatting() {
  const children = await fs.readdir(MARKDOWN_DIR);
  const markdownFiles = children.filter((child) => child.endsWith('.md'));
  await Promise.all(markdownFiles.map(async (child) => {
    const childPath = path.resolve(MARKDOWN_DIR, child);
    const contents = await fs.readFile(childPath);
    const formattedContents = Buffer.concat([
      Buffer.from(`${HEADER}\n`),
      contents,
      Buffer.from(`\n${FOOTER}\n`),
    ]);
    await fs.writeFile(childPath, formattedContents);
  }));
}

async function main() {
  if (!fs.existsSync(API_REPORT_JSON)) {
    console.log(`Unable to locate API report file at: ${API_REPORT_JSON}`);
    console.log('Make sure to generate the report file first by running:');
    console.log('');
    console.log('    npm run api:verify-report');
    console.log('');
    console.log('Exiting...');
    process.exit(1);
  }

  console.log('Running command:\n', API_DOC_COMMAND);
  try {
    await exec(API_DOC_COMMAND);
    await copyOverrides();
    await enrichTypeAliases();
    await addFormatting();
    await generateToc();
    await generateTempHomeMdFile();
  } catch (err) {
    console.log(err);
  }
}

main();
