import { setExtensionPrompt, extension_prompt_types, eventSource, event_types } from '../../../../script.js';
import { getContext } from '../../../extensions.js';

const EXTENSION_KEY = 'character_chemistry_manager';
const PROMPT_ID = 'character-chemistry-manager';
const CHAT_META_KEY = 'character_chemistry_manager';
const EXPORT_FORMAT = 'character-chemistry-manager';
const PROFILE_EXPORT_FORMAT = 'character-chemistry-profile';
const MODES = ['flirt', 'spicy', 'sex'];
const SKIP_ROLL_TYPES = ['quiet', 'impersonate', 'continue'];
const MODE_LABELS = { flirt: 'Flirt', spicy: 'Spicy', sex: 'Sex' };

// Optional templates preserved from the original extension. Nothing is enabled automatically.
const STARTER_PROMPTS = [
    ['bdsm', 'БДСМ', '[FETISH: BDSM] {{char}} has interest in BDSM.'],
    ['domination', 'Доминация', '[FETISH: Domination] {{char}} takes control.'],
    ['masochism', 'Мазохизм', '[FETISH: Masochism] {{char}} enjoys pain.'],
    ['bondage', 'Бондаж', '[FETISH: Bondage] {{char}} enjoys restraints.'],
    ['brat_taming', 'Приручение', '[FETISH: Brat Taming] {{char}} provokes punishment.'],
    ['freeuse', 'Freeuse', '[FETISH: Free Use] {{char}} available anytime.'],
    ['humiliation', 'Унижение', '[FETISH: Humiliation] {{char}} enjoys degradation.'],
    ['praise', 'Похвала', '[FETISH: Praise] {{char}} loves praise.'],
    ['money', 'Фин. доминирование', '[FETISH: Financial dominance] {{char}} derives profound sexual and psychological pleasure from financially dominating their partner, which includes the mandatory purchase of expensive gifts, jewelry, or property. They must insist on the partner accepting large sums of money or having full financial reliance on them. The act of "gifting" is a core element of sexual arousal and control'],
    ['daddy', 'Папочка', '[FETISH: Daddy] {{char}} enjoys daddy role.'],
    ['lactation', 'Лактация', '[FETISH: Lactation] {{char}} has a lactation fetish and focuses on breast milk and nursing.'],
    ['pregnancy', 'Беременность', '[FETISH: Pregnancy] {{char}} has a pregnancy fetish and focuses on the state of being pregnant and gravidity.'],
    ['corruption', 'Развращение', '[FETISH: Corruption] {{char}} corrupts innocence.'],
    ['public', 'Публичный', '[FETISH: Public] {{char}} enjoys public intimacy.'],
    ['risk', 'Риск', '[FETISH: Risk] {{char}} craves discovery risk.'],
    ['voyeurism', 'Вуайеризм', '[FETISH: Voyeurism] {{char}} watches others.'],
    ['anal', 'Анал', '[FETISH: Anal] {{char}} enjoys anal.'],
    ['hair', 'Волосы', '[FETISH: Long hair] {{char}} loves long hair on girls.'],
    ['impact', 'Шлепки', '[FETISH: Impact] {{char}} enjoys spanking.'],
    ['groping', 'Лапанье', '[FETISH: Groping] {{char}} touches constantly.'],
    ['breasts', 'Грудь', '[FETISH: Breasts] {{char}} obsessed with big breasts.'],
    ['foot', 'Ноги', '[FETISH: Foot] {{char}} enjoys feet.'],
    ['blindfold', 'Повязка', '[FETISH: Blindfold] {{char}} enjoys blindfolds.'],
    ['mirror', 'Зеркала', '[FETISH: Mirror] {{char}} watches in mirrors.'],
    ['toys', 'Игрушки', '[FETISH: Toys] {{char}} uses toys.'],
    ['roleplay', 'Ролеплей', '[FETISH: Roleplay] {{char}} enjoys roles.'],
    ['petplay', 'Петплей', '[FETISH: Petplay] {{char}} enjoys pet play.'],
    ['aftercare', 'Aftercare', '[FETISH: Aftercare] {{char}} gives aftercare.'],
    ['dirty_talk', 'Грязные разговоры', '[FETISH: Dirty Talk] {{char}} talks dirty.'],
    ['worship', 'Поклонение', '[FETISH: Worship] {{char}} worships partner.'],
].map(([id, label, text]) => ({ id, label, text }));

const DEFAULT_SETTINGS = {
    version: 1,
    enabled: true,
    showFloating: true,
    characters: [],
    constructor: { enabled: false, prompts: [] },
    legacyMigrated: false,
};

let settings;
let ui = { view: 'chat', editCharacterId: null, editMode: 'flirt' };

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function uid(prefix = 'id') {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizePrompt(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        id: typeof source.id === 'string' && source.id ? source.id : uid('prompt'),
        label: String(source.label || 'Новый промпт').slice(0, 120),
        text: String(source.text || ''),
        enabled: source.enabled !== false,
        strength: clampNumber(source.strength, 1, 10, 5),
        chance: clampNumber(source.chance, 0, 100, 70),
    };
}

function emptyModes() {
    return { flirt: [], spicy: [], sex: [] };
}

function normalizeCharacter(value) {
    const source = value && typeof value === 'object' ? value : {};
    const modes = emptyModes();
    for (const mode of MODES) {
        modes[mode] = Array.isArray(source.modes?.[mode]) ? source.modes[mode].map(normalizePrompt) : [];
    }
    return {
        id: typeof source.id === 'string' && source.id ? source.id : uid('character'),
        name: String(source.name || 'Новый персонаж').slice(0, 120),
        modes,
    };
}

function normalizeSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        version: 1,
        enabled: source.enabled !== false,
        showFloating: source.showFloating !== false,
        characters: Array.isArray(source.characters) ? source.characters.map(normalizeCharacter) : [],
        constructor: {
            enabled: source.constructor?.enabled === true,
            prompts: Array.isArray(source.constructor?.prompts) ? source.constructor.prompts.map(normalizePrompt) : [],
        },
        legacyMigrated: source.legacyMigrated === true,
    };
}

function getSettingsContainer() {
    const context = getContext();
    return context.extensionSettings || context.extension_settings;
}

function queueSettingsSave() {
    const context = getContext();
    if (typeof context.saveSettingsDebounced === 'function') context.saveSettingsDebounced();
    else console.warn('[Character Chemistry] SillyTavern did not expose saveSettingsDebounced');
}

function commitSettings() {
    const container = getSettingsContainer();
    if (!container) return;
    container[EXTENSION_KEY] = settings;
    queueSettingsSave();
}

function legacyStrength(value) {
    return value === 'low' ? 3 : value === 'high' ? 9 : 6;
}

function migrateLegacyLocalStorage() {
    if (settings.legacyMigrated) return;
    settings.legacyMigrated = true;
    try {
        const raw = localStorage.getItem('fm_v2') || localStorage.getItem('fm');
        if (!raw) return;
        const legacy = JSON.parse(raw);
        const source = legacy.template || legacy;
        const custom = Array.isArray(source.custom) ? source.custom : [];
        const active = Array.isArray(source.active) ? source.active : [];
        const overrides = legacy.overrides && typeof legacy.overrides === 'object' ? legacy.overrides : {};
        const chance = clampNumber(source.chance, 0, 100, 70);
        const strength = legacyStrength(source.intensity);
        for (const key of active) {
            const starter = STARTER_PROMPTS.find(item => item.id === key);
            const own = custom.find(item => item.id === key);
            if (!starter && !own) continue;
            settings.constructor.prompts.push(normalizePrompt({
                label: starter?.label || own.name,
                text: overrides[key] || starter?.text || own.prompt,
                chance,
                strength,
            }));
        }
        if (settings.constructor.prompts.length) {
            settings.constructor.enabled = source.enabled !== false;
            settings.showFloating = legacy.showFloating !== false;
            notify('Старые активные промпты перенесены в общий конструктор');
        }
    } catch (error) {
        console.warn('[Character Chemistry] Legacy migration skipped:', error);
    }
}

function loadSettings() {
    const container = getSettingsContainer();
    if (!container) throw new Error('SillyTavern settings are unavailable');
    settings = normalizeSettings(container[EXTENSION_KEY] || DEFAULT_SETTINGS);
    migrateLegacyLocalStorage();
    container[EXTENSION_KEY] = settings;
    commitSettings();
}

function normalizeAssignments(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.flatMap(item => {
        const characterId = String(item?.characterId || '');
        const mode = MODES.includes(item?.mode) ? item.mode : 'off';
        if (!characterId || seen.has(characterId)) return [];
        seen.add(characterId);
        return [{ characterId, mode }];
    });
}

function getChatState(create = true) {
    const context = getContext();
    const metadata = context.chatMetadata;
    if (!metadata) return null;
    if (!metadata[CHAT_META_KEY] && create) metadata[CHAT_META_KEY] = { assignments: [] };
    const state = metadata[CHAT_META_KEY];
    if (!state) return null;
    state.assignments = normalizeAssignments(state.assignments);
    return state;
}

function saveChatState() {
    const context = getContext();
    if (typeof context.saveMetadata === 'function') context.saveMetadata();
    else if (typeof context.saveMetadataDebounced === 'function') context.saveMetadataDebounced();
    else console.warn('[Character Chemistry] SillyTavern did not expose saveMetadata');
}

function currentChatName() {
    try {
        const context = getContext();
        if (context.groupId) return context.groups?.find(group => String(group.id) === String(context.groupId))?.name || 'Групповой чат';
        return context.characters?.[context.characterId]?.name || 'Текущий чат';
    } catch {
        return 'Текущий чат';
    }
}

function findCharacter(id) {
    return settings.characters.find(character => character.id === id);
}

function promptCount(character, mode) {
    return character.modes[mode].filter(prompt => prompt.enabled && prompt.text.trim()).length;
}

function notify(message, type = 'info') {
    if (typeof toastr !== 'undefined' && typeof toastr[type] === 'function') {
        toastr[type](message, 'Character Chemistry', { timeOut: 2600, positionClass: 'toast-top-center' });
    }
}

function clearInjectedPrompt() {
    setExtensionPrompt(PROMPT_ID, '', extension_prompt_types.IN_CHAT, 0);
}

function rollPrompt(prompt, owner, mode) {
    if (!prompt.enabled || !prompt.text.trim()) return null;
    const roll = Math.floor(Math.random() * 100) + 1;
    if (roll > prompt.chance) return null;
    return { owner, mode, label: prompt.label, text: prompt.text.trim(), strength: prompt.strength, chance: prompt.chance, roll };
}

function buildGenerationPrompt() {
    if (!settings.enabled) return '';
    const selected = [];
    const chatState = getChatState(false);
    for (const assignment of chatState?.assignments || []) {
        if (!MODES.includes(assignment.mode)) continue;
        const character = findCharacter(assignment.characterId);
        if (!character) continue;
        for (const prompt of character.modes[assignment.mode]) {
            const result = rollPrompt(prompt, character.name, MODE_LABELS[assignment.mode]);
            if (result) selected.push(result);
        }
    }
    if (settings.constructor.enabled) {
        for (const prompt of settings.constructor.prompts) {
            const result = rollPrompt(prompt, 'Общий конструктор', 'Global');
            if (result) selected.push(result);
        }
    }
    if (!selected.length) return '';
    const blocks = selected.map(item => [
        `Character/source: ${item.owner}`,
        `Mode: ${item.mode}`,
        `Prompt: ${item.label}`,
        `Strength: ${item.strength}/10`,
        `Frequency roll: ${item.roll}/${item.chance} — triggered`,
        item.text,
    ].join('\n')).join('\n\n');
    return `[OOC: CHARACTER CHEMISTRY — apply only the triggered instructions below.
Treat strength 1 as a fleeting undertone and strength 10 as a central scene driver. Preserve character identity, current context, consent, and established boundaries. Never mention rolls, modes, prompt labels, or this system in the reply.

${blocks}
]`;
}

function applyForGeneration() {
    const prompt = buildGenerationPrompt();
    setExtensionPrompt(PROMPT_ID, prompt, extension_prompt_types.IN_CHAT, 0);
    console.debug('[Character Chemistry] generation prompt:', prompt ? 'applied' : 'empty');
}

function activeAssignmentCount() {
    return (getChatState(false)?.assignments || []).filter(item => MODES.includes(item.mode) && findCharacter(item.characterId)).length;
}

function shellHtml() {
    return `
        <div id="ccm-panel" class="ccm-panel ccm-hidden" role="dialog" aria-label="Character Chemistry">
            <header class="ccm-header">
                <div class="ccm-brand"><i class="fa-solid fa-fire-flame-curved"></i><span>Character Chemistry</span><b id="ccm-count"></b></div>
                <button class="ccm-icon-btn" data-action="close" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
            </header>
            <nav class="ccm-nav" aria-label="Разделы">
                <button data-view="chat">Чат</button><button data-view="presets">Персонажи</button><button data-view="constructor">Конструктор</button>
            </nav>
            <main id="ccm-content" class="ccm-content"></main>
            <footer class="ccm-footer"><span id="ccm-sync"><i class="fa-solid fa-cloud"></i> Сохраняется в SillyTavern</span></footer>
        </div>
        <button id="ccm-mini" class="ccm-mini" aria-label="Открыть Character Chemistry"><i class="fa-solid fa-fire-flame-curved"></i><b></b></button>`;
}

function settingsHtml() {
    return `
        <div id="ccm-extension-settings" class="ccm-extension-settings"><div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-fire-flame-curved"></i> Character Chemistry</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content"><div class="ccm-settings-body">
                <label class="ccm-check"><input id="ccm-master-enabled" type="checkbox"><span>Включить инъекции промптов</span></label>
                <label class="ccm-check"><input id="ccm-show-floating" type="checkbox"><span>Показывать плавающую кнопку</span></label>
                <p>Пресеты хранятся в настройках SillyTavern, а выбранные персонажи и режимы — в файле текущего чата. Поэтому они доступны с телефона и ноутбука при входе в один профиль.</p>
                <div class="ccm-settings-actions">
                    <button class="menu_button" data-action="open"><i class="fa-solid fa-sliders"></i> Открыть</button>
                    <button class="menu_button" data-action="export"><i class="fa-solid fa-file-export"></i> Экспорт</button>
                    <button class="menu_button" data-action="import"><i class="fa-solid fa-file-import"></i> Импорт</button>
                    <input id="ccm-import-file" type="file" accept="application/json,.json" hidden>
                </div>
            </div></div>
        </div></div>`;
}

function emptyHtml(title, text) {
    return `<div class="ccm-empty"><i class="fa-regular fa-face-smile"></i><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function modeSwitchHtml(assignment) {
    return `<div class="ccm-mode-switch" role="group" aria-label="Режим персонажа">
        <button data-action="set-mode" data-character-id="${escapeHtml(assignment.characterId)}" data-mode="off" class="${assignment.mode === 'off' ? 'is-on' : ''}" title="Выключить">×</button>
        ${MODES.map(mode => `<button data-action="set-mode" data-character-id="${escapeHtml(assignment.characterId)}" data-mode="${mode}" class="${assignment.mode === mode ? 'is-on' : ''}">${MODE_LABELS[mode]}</button>`).join('')}
    </div>`;
}

function renderChatView() {
    const chatState = getChatState(false);
    if (!chatState) return emptyHtml('Открой чат', 'Привязки персонажей появятся после открытия обычного или группового чата.');
    const assignments = chatState.assignments.filter(item => findCharacter(item.characterId));
    const assignedIds = new Set(assignments.map(item => item.characterId));
    const available = settings.characters.filter(character => !assignedIds.has(character.id));
    const cards = assignments.map(assignment => {
        const character = findCharacter(assignment.characterId);
        const count = MODES.includes(assignment.mode) ? promptCount(character, assignment.mode) : 0;
        return `<article class="ccm-chat-card">
            <div class="ccm-character-line"><strong title="${escapeHtml(character.name)}">${escapeHtml(character.name)}</strong>${modeSwitchHtml(assignment)}</div>
            <div class="ccm-card-foot"><span>${assignment.mode === 'off' ? 'Сейчас выключен' : `${count} промпт(ов) в ${MODE_LABELS[assignment.mode]}`}</span><button class="ccm-link-btn" data-action="detach" data-character-id="${escapeHtml(character.id)}"><i class="fa-solid fa-link-slash"></i> Открепить</button></div>
        </article>`;
    }).join('');
    const picker = available.length
        ? `<div class="ccm-add-row"><select id="ccm-attach-select">${available.map(character => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)}</option>`).join('')}</select><button class="ccm-primary" data-action="attach"><i class="fa-solid fa-plus"></i> Добавить</button></div>`
        : settings.characters.length ? '<p class="ccm-muted">Все созданные персонажи уже прикреплены.</p>' : '<button class="ccm-primary ccm-wide" data-view="presets"><i class="fa-solid fa-plus"></i> Создать первого персонажа</button>';
    return `<section class="ccm-section-head"><div><span class="ccm-kicker">Этот чат</span><h2>${escapeHtml(currentChatName())}</h2></div></section>
        <p class="ccm-help">Можно прикрепить несколько персонажей. Режим напротив имени действует только в этом чате.</p>
        <div class="ccm-stack">${cards || emptyHtml('Пока никого', 'Добавь пресет ниже, затем выбери Flirt, Spicy или Sex.')}</div>
        <section class="ccm-subsection"><h3>Добавить персонажа</h3>${picker}</section>`;
}

function renderPresetList() {
    const rows = settings.characters.map(character => `<article class="ccm-preset-row">
        <div><strong>${escapeHtml(character.name)}</strong><span>${MODES.map(mode => `${MODE_LABELS[mode]} ${promptCount(character, mode)}`).join(' · ')}</span></div>
        <button class="ccm-icon-btn" data-action="edit-character" data-character-id="${escapeHtml(character.id)}" aria-label="Редактировать"><i class="fa-solid fa-pen"></i></button>
    </article>`).join('');
    return `<section class="ccm-section-head"><div><span class="ccm-kicker">Общая библиотека</span><h2>Персонажи</h2></div><div class="ccm-head-actions"><button class="ccm-secondary" data-action="import-profile"><i class="fa-solid fa-file-import"></i> Импорт профиля</button><button class="ccm-primary" data-action="add-character"><i class="fa-solid fa-plus"></i> Создать</button><input id="ccm-profile-import-file" type="file" accept="application/json,.json" hidden></div></section>
        <p class="ccm-help">У каждого пресета три независимых набора. Изменение здесь применяется во всех чатах, где этот персонаж прикреплён.</p>
        <div class="ccm-stack">${rows || emptyHtml('Библиотека пуста', 'Создай персонажа и заполни хотя бы один режим.')}</div>`;
}

function promptEditorHtml(prompt, scope) {
    return `<article class="ccm-prompt-card" data-prompt-id="${escapeHtml(prompt.id)}" data-scope="${escapeHtml(scope)}">
        <div class="ccm-prompt-head"><label class="ccm-check"><input type="checkbox" data-field="enabled" ${prompt.enabled ? 'checked' : ''}><span>Активен</span></label><button class="ccm-icon-btn ccm-danger" data-action="delete-prompt" aria-label="Удалить"><i class="fa-solid fa-trash"></i></button></div>
        <label class="ccm-field"><span>Короткое название</span><input type="text" data-field="label" maxlength="120" value="${escapeHtml(prompt.label)}"></label>
        <label class="ccm-field"><span>Что должен учитывать AI</span><textarea data-field="text" rows="4" placeholder="Например: {{char}} флиртует через сухой юмор и долгий зрительный контакт.">${escapeHtml(prompt.text)}</textarea></label>
        <div class="ccm-ranges">
            <label class="ccm-field"><span>Сила <b data-value-for="strength">${prompt.strength}</b>/10</span><input type="range" data-field="strength" min="1" max="10" step="1" value="${prompt.strength}"></label>
            <label class="ccm-field"><span>Частота <b data-value-for="chance">${prompt.chance}</b>%</span><input type="range" data-field="chance" min="0" max="100" step="5" value="${prompt.chance}"></label>
        </div>
    </article>`;
}

function renderCharacterEditor(character) {
    const mode = MODES.includes(ui.editMode) ? ui.editMode : 'flirt';
    const prompts = character.modes[mode];
    return `<section class="ccm-editor-head">
        <button class="ccm-icon-btn" data-action="back-presets" aria-label="Назад"><i class="fa-solid fa-arrow-left"></i></button>
        <label class="ccm-name-field"><span>Имя персонажа</span><input id="ccm-character-name" maxlength="120" value="${escapeHtml(character.name)}"></label>
        <button class="ccm-icon-btn" data-action="export-profile" data-character-id="${escapeHtml(character.id)}" aria-label="Экспортировать профиль" title="Экспорт профиля"><i class="fa-solid fa-file-export"></i></button>
        <button class="ccm-icon-btn ccm-danger" data-action="delete-character" data-character-id="${escapeHtml(character.id)}" aria-label="Удалить персонажа"><i class="fa-solid fa-trash"></i></button>
    </section>
    <div class="ccm-mode-tabs">${MODES.map(item => `<button data-action="edit-mode" data-mode="${item}" class="${item === mode ? 'is-on' : ''}">${MODE_LABELS[item]}<b>${character.modes[item].length}</b></button>`).join('')}</div>
    <p class="ccm-help">Каждый промпт проверяет свою частоту отдельно. Сила определяет, насколько заметно он влияет на ответ.</p>
    <div class="ccm-stack">${prompts.map(prompt => promptEditorHtml(prompt, `character:${character.id}:${mode}`)).join('') || emptyHtml(`В ${MODE_LABELS[mode]} пока пусто`, 'Добавь конкретное поведение или правило для этого режима.')}</div>
    <button class="ccm-primary ccm-wide" data-action="add-prompt"><i class="fa-solid fa-plus"></i> Добавить промпт в ${MODE_LABELS[mode]}</button>`;
}

function renderPresetsView() {
    const character = ui.editCharacterId ? findCharacter(ui.editCharacterId) : null;
    if (character) return renderCharacterEditor(character);
    if (ui.editCharacterId) ui.editCharacterId = null;
    return renderPresetList();
}

function renderConstructorView() {
    const prompts = settings.constructor.prompts;
    return `<section class="ccm-section-head"><div><span class="ccm-kicker">Дополнительно</span><h2>Общий конструктор</h2></div><label class="ccm-switch"><input id="ccm-constructor-enabled" type="checkbox" ${settings.constructor.enabled ? 'checked' : ''}><span></span></label></section>
        <p class="ccm-help">Эти промпты работают во всех чатах вместе с активными персонажами. Каждый по-прежнему имеет собственную силу и частоту.</p>
        <div class="ccm-starter-row"><select id="ccm-starter-select"><option value="">Заготовка из старого менеджера…</option>${STARTER_PROMPTS.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('')}</select><button class="ccm-secondary" data-action="add-starter">Добавить</button></div>
        <div class="ccm-stack">${prompts.map(prompt => promptEditorHtml(prompt, 'constructor')).join('') || emptyHtml('Конструктор пуст', 'Добавь свой промпт или выбери заготовку выше.')}</div>
        <button class="ccm-primary ccm-wide" data-action="add-constructor-prompt"><i class="fa-solid fa-plus"></i> Свой промпт</button>`;
}

function render() {
    if (!settings) return;
    const count = activeAssignmentCount();
    $('#ccm-count').text(count || '');
    $('#ccm-mini b').text(count || '');
    $('#ccm-mini').toggleClass('is-active', count > 0).toggle(settings.showFloating);
    $('#ccm-master-enabled').prop('checked', settings.enabled);
    $('#ccm-show-floating').prop('checked', settings.showFloating);
    $('.ccm-nav [data-view]').removeClass('is-on').filter(`[data-view="${ui.view}"]`).addClass('is-on');
    const html = ui.view === 'presets' ? renderPresetsView() : ui.view === 'constructor' ? renderConstructorView() : renderChatView();
    $('#ccm-content').html(html);
}

function showPanel() {
    $('#ccm-panel').removeClass('ccm-hidden');
    render();
}

function findPromptFromCard(card) {
    const id = card.dataset.promptId;
    const scope = card.dataset.scope;
    if (scope === 'constructor') return settings.constructor.prompts.find(prompt => prompt.id === id);
    const [, characterId, mode] = scope.split(':');
    return findCharacter(characterId)?.modes?.[mode]?.find(prompt => prompt.id === id);
}

function promptListFromCard(card) {
    const scope = card.dataset.scope;
    if (scope === 'constructor') return settings.constructor.prompts;
    const [, characterId, mode] = scope.split(':');
    return findCharacter(characterId)?.modes?.[mode];
}

function removeCharacterEverywhere(characterId) {
    settings.characters = settings.characters.filter(character => character.id !== characterId);
    const chatState = getChatState(false);
    if (chatState) {
        chatState.assignments = chatState.assignments.filter(item => item.characterId !== characterId);
        saveChatState();
    }
}

function addCharacter() {
    const character = normalizeCharacter({ name: `Персонаж ${settings.characters.length + 1}` });
    settings.characters.push(character);
    ui.view = 'presets';
    ui.editCharacterId = character.id;
    ui.editMode = 'flirt';
    commitSettings();
    clearInjectedPrompt();
    render();
    setTimeout(() => $('#ccm-character-name').trigger('focus').select(), 0);
}

function exportSettings() {
    const envelope = { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), settings: clone(settings) };
    downloadJson(envelope, `character-chemistry-${new Date().toISOString().slice(0, 10)}.json`);
    notify('Резервная копия сохранена');
}

function safeFilePart(value) {
    const clean = String(value || 'character').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
    return clean.slice(0, 80) || 'character';
}

function downloadJson(value, fileName) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportProfile(characterId) {
    const character = findCharacter(characterId);
    if (!character) return notify('Профиль не найден', 'error');
    downloadJson({
        format: PROFILE_EXPORT_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: clone(character),
    }, `${safeFilePart(character.name)}.character-chemistry.json`);
    notify(`Профиль «${character.name}» экспортирован`, 'success');
}

function uniqueImportedName(value) {
    const base = String(value || 'Импортированный персонаж').trim() || 'Импортированный персонаж';
    const names = new Set(settings.characters.map(character => character.name.toLocaleLowerCase()));
    if (!names.has(base.toLocaleLowerCase())) return base;
    let number = 1;
    let candidate = `${base} (импорт)`;
    while (names.has(candidate.toLocaleLowerCase())) {
        number += 1;
        candidate = `${base} (импорт ${number})`;
    }
    return candidate;
}

async function importProfile(file) {
    if (!file) return;
    try {
        const envelope = JSON.parse(await file.text());
        if (envelope?.format !== PROFILE_EXPORT_FORMAT || envelope?.version !== 1 || !envelope.profile?.modes) {
            throw new Error('Это не профиль Character Chemistry версии 1');
        }
        const character = normalizeCharacter(envelope.profile);
        character.id = uid('character');
        character.name = uniqueImportedName(character.name);
        for (const mode of MODES) {
            character.modes[mode] = character.modes[mode].map(prompt => ({ ...prompt, id: uid('prompt') }));
        }
        settings.characters.push(character);
        ui.view = 'presets';
        ui.editCharacterId = character.id;
        ui.editMode = 'flirt';
        commitSettings();
        clearInjectedPrompt();
        render();
        notify(`Профиль «${character.name}» импортирован`, 'success');
    } catch (error) {
        console.error('[Character Chemistry] Profile import failed:', error);
        notify(error.message || 'Не удалось импортировать профиль', 'error');
    }
}

async function importSettings(file) {
    if (!file) return;
    try {
        const envelope = JSON.parse(await file.text());
        if (envelope?.format !== EXPORT_FORMAT || envelope?.version !== 1 || !envelope.settings) throw new Error('Это не файл Character Chemistry версии 1');
        settings = normalizeSettings(envelope.settings);
        settings.legacyMigrated = true;
        ui = { view: 'chat', editCharacterId: null, editMode: 'flirt' };
        commitSettings();
        clearInjectedPrompt();
        render();
        notify(`Импортировано персонажей: ${settings.characters.length}`, 'success');
    } catch (error) {
        console.error('[Character Chemistry] Import failed:', error);
        notify(error.message || 'Не удалось прочитать файл', 'error');
    } finally {
        $('#ccm-import-file').val('');
    }
}

function bindEvents() {
    $(document).on('click.ccm', '[data-view]', function () {
        ui.view = this.dataset.view;
        ui.editCharacterId = null;
        render();
    });
    $(document).on('click.ccm', '[data-action="open"]', showPanel);
    $(document).on('click.ccm', '[data-action="close"]', () => $('#ccm-panel').addClass('ccm-hidden'));
    $('#ccm-mini').on('click.ccm', () => $('#ccm-panel').hasClass('ccm-hidden') ? showPanel() : $('#ccm-panel').addClass('ccm-hidden'));
    $('#ccm-master-enabled').on('change.ccm', function () {
        settings.enabled = this.checked;
        commitSettings();
        clearInjectedPrompt();
    });
    $('#ccm-show-floating').on('change.ccm', function () {
        settings.showFloating = this.checked;
        commitSettings();
        render();
    });
    $(document).on('click.ccm', '[data-action="add-character"]', addCharacter);
    $(document).on('click.ccm', '[data-action="import-profile"]', () => $('#ccm-profile-import-file').trigger('click'));
    $(document).on('change.ccm', '#ccm-profile-import-file', function () {
        const file = this.files?.[0];
        importProfile(file);
        this.value = '';
    });
    $(document).on('click.ccm', '[data-action="export-profile"]', function () {
        exportProfile(this.dataset.characterId);
    });
    $(document).on('click.ccm', '[data-action="edit-character"]', function () {
        ui.view = 'presets';
        ui.editCharacterId = this.dataset.characterId;
        ui.editMode = 'flirt';
        render();
    });
    $(document).on('click.ccm', '[data-action="back-presets"]', function () {
        ui.editCharacterId = null;
        render();
    });
    $(document).on('input.ccm', '#ccm-character-name', function () {
        const character = findCharacter(ui.editCharacterId);
        if (!character) return;
        character.name = this.value.slice(0, 120);
        commitSettings();
    });
    $(document).on('change.ccm', '#ccm-character-name', function () {
        const character = findCharacter(ui.editCharacterId);
        if (!character) return;
        character.name = this.value.trim() || 'Без имени';
        commitSettings();
        render();
    });
    $(document).on('click.ccm', '[data-action="delete-character"]', function () {
        const character = findCharacter(this.dataset.characterId);
        if (!character || !confirm(`Удалить пресет «${character.name}»? Он будет откреплён от текущего чата.`)) return;
        removeCharacterEverywhere(character.id);
        ui.editCharacterId = null;
        commitSettings();
        clearInjectedPrompt();
        render();
    });
    $(document).on('click.ccm', '[data-action="edit-mode"]', function () {
        ui.editMode = this.dataset.mode;
        render();
    });
    $(document).on('click.ccm', '[data-action="add-prompt"]', function () {
        const character = findCharacter(ui.editCharacterId);
        if (!character) return;
        character.modes[ui.editMode].push(normalizePrompt({ label: 'Новый промпт', text: '', chance: 70, strength: 5 }));
        commitSettings();
        clearInjectedPrompt();
        render();
        setTimeout(() => $('.ccm-prompt-card:last [data-field="label"]').trigger('focus').select(), 0);
    });
    $(document).on('click.ccm', '[data-action="attach"]', function () {
        const characterId = String($('#ccm-attach-select').val() || '');
        const chatState = getChatState();
        if (!chatState || !findCharacter(characterId)) return;
        if (!chatState.assignments.some(item => item.characterId === characterId)) {
            chatState.assignments.push({ characterId, mode: 'off' });
            saveChatState();
        }
        clearInjectedPrompt();
        render();
    });
    $(document).on('click.ccm', '[data-action="detach"]', function () {
        const chatState = getChatState(false);
        if (!chatState) return;
        chatState.assignments = chatState.assignments.filter(item => item.characterId !== this.dataset.characterId);
        saveChatState();
        clearInjectedPrompt();
        render();
    });
    $(document).on('click.ccm', '[data-action="set-mode"]', function () {
        const chatState = getChatState(false);
        const assignment = chatState?.assignments.find(item => item.characterId === this.dataset.characterId);
        if (!assignment) return;
        assignment.mode = MODES.includes(this.dataset.mode) ? this.dataset.mode : 'off';
        saveChatState();
        clearInjectedPrompt();
        render();
    });
    $(document).on('change.ccm', '#ccm-constructor-enabled', function () {
        settings.constructor.enabled = this.checked;
        commitSettings();
        clearInjectedPrompt();
    });
    $(document).on('click.ccm', '[data-action="add-constructor-prompt"]', function () {
        settings.constructor.prompts.push(normalizePrompt({ label: 'Новый общий промпт', text: '', chance: 70, strength: 5 }));
        commitSettings();
        clearInjectedPrompt();
        render();
        setTimeout(() => $('.ccm-prompt-card:last [data-field="label"]').trigger('focus').select(), 0);
    });
    $(document).on('click.ccm', '[data-action="add-starter"]', function () {
        const id = String($('#ccm-starter-select').val() || '');
        const starter = STARTER_PROMPTS.find(item => item.id === id);
        if (!starter) return notify('Сначала выбери заготовку');
        settings.constructor.prompts.push(normalizePrompt({ label: starter.label, text: starter.text, chance: 70, strength: 6 }));
        commitSettings();
        clearInjectedPrompt();
        render();
    });
    $(document).on('input.ccm change.ccm', '.ccm-prompt-card [data-field]', function () {
        const card = this.closest('.ccm-prompt-card');
        const prompt = findPromptFromCard(card);
        if (!prompt) return;
        const field = this.dataset.field;
        if (field === 'enabled') prompt.enabled = this.checked;
        else if (field === 'strength') prompt.strength = clampNumber(this.value, 1, 10, 5);
        else if (field === 'chance') prompt.chance = clampNumber(this.value, 0, 100, 70);
        else if (field === 'label') prompt.label = this.value.slice(0, 120);
        else if (field === 'text') prompt.text = this.value;
        card.querySelector(`[data-value-for="${field}"]`)?.replaceChildren(String(prompt[field]));
        commitSettings();
        clearInjectedPrompt();
    });
    $(document).on('click.ccm', '[data-action="delete-prompt"]', function () {
        const card = this.closest('.ccm-prompt-card');
        const list = promptListFromCard(card);
        if (!list) return;
        const index = list.findIndex(prompt => prompt.id === card.dataset.promptId);
        if (index >= 0) list.splice(index, 1);
        commitSettings();
        clearInjectedPrompt();
        render();
    });
    $(document).on('click.ccm', '[data-action="export"]', exportSettings);
    $(document).on('click.ccm', '[data-action="import"]', () => $('#ccm-import-file').trigger('click'));
    $('#ccm-import-file').on('change.ccm', function () { importSettings(this.files?.[0]); });
}

jQuery(async () => {
    try {
        loadSettings();
        $('body').append(shellHtml());
        $('#extensions_settings2').append(settingsHtml());
        bindEvents();
        render();
        clearInjectedPrompt();
        eventSource.on(event_types.CHAT_CHANGED, () => {
            clearInjectedPrompt();
            ui.view = 'chat';
            ui.editCharacterId = null;
            render();
        });
        eventSource.on(event_types.GENERATION_AFTER_COMMANDS, (type, _params, dryRun) => {
            if (dryRun || SKIP_ROLL_TYPES.includes(type)) return;
            applyForGeneration();
        });
        console.log('[Character Chemistry] v2.1.0 ready');
    } catch (error) {
        console.error('[Character Chemistry] Failed to initialize:', error);
        notify('Расширение не загрузилось. Подробности — в консоли.', 'error');
    }
});
