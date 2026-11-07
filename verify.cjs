const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, 'index.js');
let source = fs.readFileSync(sourcePath, 'utf8');
source = source.replace(/^import .*;\r?\n/gm, '');
source = source.slice(0, source.indexOf('jQuery(async () =>'));

const context = vm.createContext({
    console,
    crypto: { randomUUID: () => 'test-id' },
    localStorage: { getItem: () => null },
    setExtensionPrompt: () => {},
    extension_prompt_types: { IN_CHAT: 1 },
    getContext: () => context.mockContext,
    Math: Object.create(Math),
});
context.globalThis = context;
context.mockContext = {
    extensionSettings: {},
    chatMetadata: { character_chemistry_manager: { assignments: [] } },
    saveSettingsDebounced() {},
    saveMetadata() {},
};

vm.runInContext(source, context, { filename: sourcePath });
vm.runInContext(`
    settings = normalizeSettings({
        enabled: true,
        characters: [
            {
                id: 'alex',
                name: 'Alex',
                modes: {
                    flirt: [{ id: 'a1', label: 'Eyes', text: 'FLIRT_ONLY', enabled: true, strength: 4, chance: 100 }],
                    spicy: [{ id: 'a2', label: 'Heat', text: 'SPICY_ONLY', enabled: true, strength: 7, chance: 100 }],
                    sex: [],
                },
            },
            {
                id: 'mia',
                name: 'Mia',
                modes: {
                    flirt: [],
                    spicy: [{ id: 'm1', label: 'Voice', text: 'MIA_SPICY', enabled: true, strength: 6, chance: 100 }],
                    sex: [],
                },
            },
        ],
        constructor: {
            enabled: true,
            prompts: [
                { id: 'g1', label: 'Global', text: 'GLOBAL_RULE', enabled: true, strength: 3, chance: 100 },
                { id: 'g2', label: 'Never', text: 'NEVER_RULE', enabled: true, strength: 10, chance: 0 },
            ],
        },
        legacyMigrated: true,
    });
`, context);

context.mockContext.chatMetadata.character_chemistry_manager.assignments = [
    { characterId: 'alex', mode: 'flirt' },
    { characterId: 'mia', mode: 'spicy' },
];
context.Math.random = () => 0.5;

const prompt = vm.runInContext('buildGenerationPrompt()', context);
assert.match(prompt, /Character\/source: Alex/);
assert.match(prompt, /FLIRT_ONLY/);
assert.doesNotMatch(prompt, /SPICY_ONLY/);
assert.match(prompt, /Character\/source: Mia/);
assert.match(prompt, /MIA_SPICY/);
assert.match(prompt, /GLOBAL_RULE/);
assert.doesNotMatch(prompt, /NEVER_RULE/);
assert.match(prompt, /Strength: 4\/10/);

const assignments = vm.runInContext(`normalizeAssignments([
    { characterId: 'alex', mode: 'sex' },
    { characterId: 'alex', mode: 'flirt' },
    { characterId: 'mia', mode: 'unknown' }
])`, context);
assert.deepEqual(JSON.parse(JSON.stringify(assignments)), [
    { characterId: 'alex', mode: 'sex' },
    { characterId: 'mia', mode: 'off' },
]);

assert.equal(vm.runInContext(`escapeHtml('<img src=x onerror=1>')`, context), '&lt;img src=x onerror=1&gt;');
assert.equal(vm.runInContext(`uniqueImportedName('Alex')`, context), 'Alex (импорт)');
assert.equal(vm.runInContext(`safeFilePart('A/B:*?')`, context), 'A-B-');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
assert.equal(manifest.version, '2.2.0');
assert.equal(manifest.auto_update, false);

assert.match(source, /character-chemistry-profile/);
assert.match(source, /function exportProfile/);
assert.match(source, /async function importProfile/);
assert.match(source, /new Popup\(/);
assert.match(source, /drawer-content openDrawer/);
assert.match(source, /class="menu_button/);
assert.match(source, /class="text_pole/);
assert.match(source, /settingsSectionWrap/);
assert.match(source, /checkbox_label/);
assert.doesNotMatch(source, /ccm-prompt-card/);
assert.doesNotMatch(source, /data-action="add-starter"/);

const styleSource = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
for (const property of ['color', 'background', 'border', 'border-radius', 'box-shadow', 'font', 'font-family', 'font-size', 'opacity', 'filter', 'backdrop-filter']) {
    assert.doesNotMatch(styleSource, new RegExp(`(^|[;{]\\s*)${property}\\s*:`, 'm'), `style.css must not define ${property}`);
}

console.log('Character Chemistry verification: OK');
