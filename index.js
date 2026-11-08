import { setExtensionPrompt, extension_prompt_types, eventSource, event_types, chat_metadata, saveMetadata, updateChatMetadata } from '../../../../script.js';
import { getContext } from '../../../extensions.js';
import { Popup, POPUP_TYPE } from '../../../popup.js';

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
    version: 2,
    enabled: true,
    floating: {
        desktop: { visible: true, position: null },
        mobile: { visible: true, position: null },
    },
    characters: [],
    constructor: { enabled: false, prompts: [] },
    legacyMigrated: false,
};

let settings;
let ui = { view: 'chat', editCharacterId: null, editMode: 'flirt' };
let managerPopup = null;

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

function floatingDeviceKey() {
    return globalThis.matchMedia?.('(max-width: 600px)')?.matches ? 'mobile' : 'desktop';
}

function normalizeFloatingPosition(value) {
    if (!value || typeof value !== 'object') return null;
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: clampNumber(x, 0, 1, 1), y: clampNumber(y, 0, 1, 0.8) };
}

function normalizeFloatingDevice(value, visibleFallback) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        visible: typeof source.visible === 'boolean' ? source.visible : visibleFallback,
        position: normalizeFloatingPosition(source.position),
    };
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
        version: 2,
        enabled: source.enabled !== false,
        floating: {
            desktop: normalizeFloatingDevice(source.floating?.desktop, source.showFloating !== false),
            mobile: normalizeFloatingDevice(source.floating?.mobile, true),
        },
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
            settings.floating[floatingDeviceKey()].visible = legacy.showFloating !== false;
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
        const legacyModeEnabled = MODES.includes(item?.mode);
        const mode = legacyModeEnabled ? item.mode : 'flirt';
        const enabled = typeof item?.enabled === 'boolean' ? item.enabled : legacyModeEnabled;
        if (!characterId || seen.has(characterId)) return [];
        seen.add(characterId);
        return [{ characterId, enabled, mode }];
    });
}

function hasOpenChat(context) {
    const hasValue = value => value !== undefined && value !== null && value !== '' && value !== -1;
    let chatId = context.chatId;
    try {
        if (!hasValue(chatId) && typeof context.getCurrentChatId === 'function') chatId = context.getCurrentChatId();
    } catch {
        // Older SillyTavern builds may throw while a chat is still loading.
    }
    return hasValue(chatId)
        || hasValue(context.groupId)
        || hasValue(context.characterId)
        || (Array.isArray(context.chat) && context.chat.length > 0);
}

function getChatState(create = true) {
    let context = getContext();
    if (!hasOpenChat(context)) return null;
    let metadata = context.chatMetadata ?? chat_metadata;
    if (!metadata && create) {
        const initial = { [CHAT_META_KEY]: { assignments: [] } };
        if (typeof context.updateChatMetadata === 'function') context.updateChatMetadata(initial, false);
        else if (typeof updateChatMetadata === 'function') updateChatMetadata(initial, false);
        context = getContext();
        metadata = context.chatMetadata ?? chat_metadata;
    }
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
    else if (typeof saveMetadata === 'function') saveMetadata();
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
        if (!assignment.enabled || !MODES.includes(assignment.mode)) continue;
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
    if (!settings.enabled) return 0;
    return (getChatState(false)?.assignments || []).filter(item => {
        const character = findCharacter(item.characterId);
        return item.enabled && MODES.includes(item.mode) && character && promptCount(character, item.mode) > 0;
    }).length;
}

function currentFloatingSettings() {
    return settings.floating[floatingDeviceKey()];
}

function visibleViewport() {
    const viewport = globalThis.visualViewport;
    return {
        left: Number(viewport?.offsetLeft || 0),
        top: Number(viewport?.offsetTop || 0),
        width: Number(viewport?.width || globalThis.innerWidth || 0),
        height: Number(viewport?.height || globalThis.innerHeight || 0),
    };
}

function floatingBounds(button) {
    const viewport = visibleViewport();
    const margin = 8;
    const width = button.offsetWidth || 42;
    const height = button.offsetHeight || 42;
    return {
        left: viewport.left + margin,
        top: viewport.top + margin,
        width: Math.max(0, viewport.width - width - margin * 2),
        height: Math.max(0, viewport.height - height - margin * 2),
    };
}

function applyFloatingButtonPosition() {
    const button = document.getElementById('ccm-mini');
    if (!button) return;
    const position = currentFloatingSettings().position;
    if (!position) {
        button.style.removeProperty('left');
        button.style.removeProperty('top');
        button.style.removeProperty('right');
        button.style.removeProperty('bottom');
        return;
    }
    const bounds = floatingBounds(button);
    button.style.left = `${Math.round(bounds.left + bounds.width * position.x)}px`;
    button.style.top = `${Math.round(bounds.top + bounds.height * position.y)}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
}

function saveFloatingButtonPosition(button) {
    const bounds = floatingBounds(button);
    const rect = button.getBoundingClientRect();
    currentFloatingSettings().position = {
        x: bounds.width ? clampNumber((rect.left - bounds.left) / bounds.width, 0, 1, 1) : 0,
        y: bounds.height ? clampNumber((rect.top - bounds.top) / bounds.height, 0, 1, 0.8) : 0,
    };
    commitSettings();
}

function bindFloatingButton() {
    const button = document.getElementById('ccm-mini');
    if (!button) return;
    let drag = null;
    let suppressClickUntil = 0;

    button.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        const rect = button.getBoundingClientRect();
        drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            left: rect.left,
            top: rect.top,
            moved: false,
        };
        button.setPointerCapture?.(event.pointerId);
    });

    button.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(deltaX, deltaY) < 6) return;
        drag.moved = true;
        const bounds = floatingBounds(button);
        button.style.left = `${clampNumber(drag.left + deltaX, bounds.left, bounds.left + bounds.width, bounds.left)}px`;
        button.style.top = `${clampNumber(drag.top + deltaY, bounds.top, bounds.top + bounds.height, bounds.top)}px`;
        button.style.right = 'auto';
        button.style.bottom = 'auto';
        event.preventDefault();
    });

    button.addEventListener('pointerup', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        button.releasePointerCapture?.(event.pointerId);
        if (drag.moved) {
            saveFloatingButtonPosition(button);
            suppressClickUntil = Date.now() + 500;
        }
        drag = null;
    });

    button.addEventListener('pointercancel', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag = null;
        applyFloatingButtonPosition();
    });

    button.addEventListener('click', event => {
        if (Date.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        showPanel();
    });

    $(globalThis).on('resize.ccm', applyFloatingButtonPosition);
    globalThis.visualViewport?.addEventListener('resize', applyFloatingButtonPosition);
    globalThis.visualViewport?.addEventListener('scroll', applyFloatingButtonPosition);
}

function panelHtml() {
    return `
        <div id="ccm-panel" class="ccm-panel" aria-label="Character Chemistry">
            <header class="ccm-header">
                <h3 class="ccm-brand"><i class="fa-solid fa-fire-flame-curved"></i><span>Character Chemistry</span><small id="ccm-count"></small></h3>
            </header>
            <nav class="ccm-nav" aria-label="Разделы">
                <button class="menu_button" data-view="chat">Чат</button><button class="menu_button" data-view="presets">Персонажи</button><button class="menu_button" data-view="constructor">Конструктор</button>
            </nav>
            <main id="ccm-content" class="ccm-content"></main>
        </div>`;
}

function shellHtml() {
    return `<button id="ccm-mini" class="menu_button ccm-mini" aria-label="Открыть Character Chemistry" title="Character Chemistry"><i class="fa-solid fa-fire-flame-curved"></i><small></small></button>`;
}

function settingsHtml() {
    return `
        <div id="ccm-extension-settings" class="ccm-extension-settings"><div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-fire-flame-curved"></i> Character Chemistry</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content"><div class="ccm-settings-body">
                <label class="checkbox_label"><input id="ccm-master-enabled" type="checkbox"><span>Включить инъекции промптов</span></label>
                <label class="checkbox_label"><input id="ccm-show-floating" type="checkbox"><span>Показывать плавающую кнопку на этом устройстве</span></label>
                <small>Пресеты хранятся в настройках SillyTavern, а выбранные персонажи и режимы — в файле текущего чата.</small>
                <div class="ccm-settings-actions">
                    <button class="menu_button menu_button_icon" data-action="open"><i class="fa-solid fa-sliders"></i><span>Открыть</span></button>
                    <button class="menu_button menu_button_icon" data-action="export"><i class="fa-solid fa-file-export"></i><span>Экспорт</span></button>
                    <button class="menu_button menu_button_icon" data-action="import"><i class="fa-solid fa-file-import"></i><span>Импорт</span></button>
                    <input id="ccm-import-file" type="file" accept="application/json,.json" hidden>
                </div>
            </div></div>
        </div></div>`;
}

function emptyHtml(title, text) {
    return `<p class="ccm-empty"><strong>${escapeHtml(title)}</strong><br><small>${escapeHtml(text)}</small></p>`;
}

function modeSwitchHtml(assignment) {
    return `<div class="ccm-mode-switch" role="group" aria-label="Режим персонажа">
        ${MODES.map(mode => `<button class="menu_button ${assignment.mode === mode ? 'active' : ''}" data-action="set-mode" data-character-id="${escapeHtml(assignment.characterId)}" data-mode="${mode}">${MODE_LABELS[mode]}</button>`).join('')}
    </div>`;
}

function injectionStatusHtml(assignments) {
    const enabled = assignments.flatMap(assignment => {
        if (!assignment.enabled || !MODES.includes(assignment.mode)) return [];
        const character = findCharacter(assignment.characterId);
        if (!character) return [];
        return [{ character, mode: assignment.mode, count: promptCount(character, assignment.mode) }];
    });
    if (!settings.enabled) {
        return '<section class="ccm-injection-status settingsSectionWrap"><strong>Инжект выключен</strong><small>Включи инъекции промптов в настройках расширения.</small></section>';
    }
    if (!enabled.length) {
        return '<section class="ccm-injection-status settingsSectionWrap"><strong>Никто не инжектируется</strong><small>Поставь галочку рядом с нужным персонажем.</small></section>';
    }
    const active = enabled.filter(item => item.count > 0);
    const empty = enabled.filter(item => item.count === 0);
    const activeText = active.length
        ? `Инжектируются: ${active.map(item => `${escapeHtml(item.character.name)} — ${MODE_LABELS[item.mode]} (до ${item.count})`).join(' · ')}`
        : 'Сейчас инжектировать нечего: в выбранных режимах нет активных промптов.';
    const emptyText = empty.length
        ? `<small>Включены без активных промптов: ${empty.map(item => `${escapeHtml(item.character.name)} — ${MODE_LABELS[item.mode]}`).join(' · ')}</small>`
        : '';
    return `<section class="ccm-injection-status settingsSectionWrap"><strong>Инжект сейчас</strong><small>${activeText}</small>${emptyText}</section>`;
}

function assignmentStatusText(assignment, character) {
    const mode = MODE_LABELS[assignment.mode];
    const count = promptCount(character, assignment.mode);
    if (!assignment.enabled) return `Выключен · выбран режим ${mode}`;
    if (!settings.enabled) return `Включён · режим ${mode} · общий инжект отключён`;
    if (!count) return `Включён · режим ${mode} · нет активных промптов`;
    return `Инжектируется · режим ${mode} · до ${count} промпт(ов) за ответ`;
}

function renderChatView() {
    const chatState = getChatState(true);
    if (!chatState) return emptyHtml('Открой чат', 'Привязки персонажей появятся после открытия обычного или группового чата.');
    const assignments = chatState.assignments.filter(item => findCharacter(item.characterId));
    const assignedIds = new Set(assignments.map(item => item.characterId));
    const available = settings.characters.filter(character => !assignedIds.has(character.id));
    const cards = assignments.map(assignment => {
        const character = findCharacter(assignment.characterId);
        return `<article class="ccm-chat-card settingsSectionWrap ${assignment.enabled ? '' : 'disabled'}">
            <div class="ccm-character-line"><label class="checkbox_label ccm-character-toggle"><input type="checkbox" data-action="toggle-character" data-character-id="${escapeHtml(character.id)}" ${assignment.enabled ? 'checked' : ''}><strong title="${escapeHtml(character.name)}">${escapeHtml(character.name)}</strong></label>${modeSwitchHtml(assignment)}</div>
            <div class="ccm-card-foot"><small>${assignmentStatusText(assignment, character)}</small><button class="menu_button fa-fw" data-action="detach" data-character-id="${escapeHtml(character.id)}" aria-label="Открепить" title="Открепить"><i class="fa-solid fa-link-slash"></i></button></div>
        </article>`;
    }).join('');
    const picker = available.length
        ? `<div class="ccm-add-row"><select class="text_pole" id="ccm-attach-select">${available.map(character => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)}</option>`).join('')}</select><button class="menu_button menu_button_icon" data-action="attach"><i class="fa-solid fa-plus"></i><span>Добавить</span></button></div>`
        : settings.characters.length ? '<small>Все созданные персонажи уже прикреплены.</small>' : '<button class="menu_button ccm-wide" data-view="presets"><i class="fa-solid fa-plus"></i> Создать первого персонажа</button>';
    return `<section class="ccm-section-head"><div><small>Этот чат</small><h3>${escapeHtml(currentChatName())}</h3></div></section>
        ${injectionStatusHtml(assignments)}
        <small class="ccm-help">Галочка включает персонажа. Flirt, Spicy или Sex выбирает его активный режим только для этого чата.</small>
        <div class="ccm-stack">${cards || emptyHtml('Пока никого', 'Добавь пресет ниже, затем выбери Flirt, Spicy или Sex.')}</div>
        <section class="ccm-subsection"><h4>Добавить персонажа</h4>${picker}</section>`;
}

function renderPresetList() {
    const rows = settings.characters.map(character => `<button class="menu_button ccm-preset-row" data-action="edit-character" data-character-id="${escapeHtml(character.id)}">
        <div><strong>${escapeHtml(character.name)}</strong><span>${MODES.map(mode => `${MODE_LABELS[mode]} ${promptCount(character, mode)}`).join(' · ')}</span></div>
        <i class="fa-solid fa-chevron-right"></i>
    </button>`).join('');
    return `<section class="ccm-section-head"><div><small>Общая библиотека</small><h3>Персонажи</h3></div><div class="ccm-head-actions"><button class="menu_button fa-fw" data-action="import-profile" aria-label="Импорт профиля" title="Импорт профиля"><i class="fa-solid fa-file-import"></i></button><button class="menu_button menu_button_icon" data-action="add-character"><i class="fa-solid fa-plus"></i><span>Создать</span></button><input id="ccm-profile-import-file" type="file" accept="application/json,.json" hidden></div></section>
        <small class="ccm-help">Изменение пресета применяется во всех чатах, где этот персонаж прикреплён.</small>
        <div class="ccm-stack">${rows || emptyHtml('Библиотека пуста', 'Создай персонажа и заполни хотя бы один режим.')}</div>`;
}

function promptRowHtml(prompt, scope) {
    const preview = prompt.text.trim() || 'Нажми, чтобы заполнить промпт';
    return `<article class="ccm-prompt-row settingsSectionWrap ${prompt.enabled ? '' : 'disabled'}" data-prompt-id="${escapeHtml(prompt.id)}" data-scope="${escapeHtml(scope)}">
        <label class="checkbox_label ccm-prompt-toggle" title="Включить или выключить"><input type="checkbox" data-field="enabled" aria-label="Активен" ${prompt.enabled ? 'checked' : ''}></label>
        <button class="menu_button ccm-prompt-open" data-action="edit-prompt">
            <strong>${escapeHtml(prompt.label || 'Без названия')}</strong>
            <small>${escapeHtml(preview)}</small>
            <span>Сила ${prompt.strength}/10 · Частота ${prompt.chance}%</span>
        </button>
        <button class="menu_button fa-fw" data-action="delete-prompt" aria-label="Удалить" title="Удалить"><i class="fa-solid fa-trash"></i></button>
    </article>`;
}

function renderCharacterEditor(character) {
    const mode = MODES.includes(ui.editMode) ? ui.editMode : 'flirt';
    const prompts = character.modes[mode];
    return `<section class="ccm-editor-head">
        <button class="menu_button fa-fw" data-action="back-presets" aria-label="Назад" title="Назад"><i class="fa-solid fa-arrow-left"></i></button>
        <label class="ccm-name-field"><small>Имя персонажа</small><input class="text_pole" id="ccm-character-name" maxlength="120" value="${escapeHtml(character.name)}"></label>
        <button class="menu_button fa-fw" data-action="export-profile" data-character-id="${escapeHtml(character.id)}" aria-label="Экспортировать профиль" title="Экспорт профиля"><i class="fa-solid fa-file-export"></i></button>
        <button class="menu_button fa-fw" data-action="delete-character" data-character-id="${escapeHtml(character.id)}" aria-label="Удалить персонажа" title="Удалить персонажа"><i class="fa-solid fa-trash"></i></button>
    </section>
    <div class="ccm-mode-tabs">${MODES.map(item => `<button class="menu_button ${item === mode ? 'active' : ''}" data-action="edit-mode" data-mode="${item}">${MODE_LABELS[item]} <small>${character.modes[item].length}</small></button>`).join('')}</div>
    <small class="ccm-help">Нажми на строку промпта, чтобы изменить текст, название, силу и частоту.</small>
    <div class="ccm-stack">${prompts.map(prompt => promptRowHtml(prompt, `character:${character.id}:${mode}`)).join('') || emptyHtml(`В ${MODE_LABELS[mode]} пока пусто`, 'Добавь конкретное поведение или правило для этого режима.')}</div>
    <button class="menu_button ccm-wide" data-action="add-prompt"><i class="fa-solid fa-plus"></i> Добавить промпт в ${MODE_LABELS[mode]}</button>`;
}

function renderPresetsView() {
    const character = ui.editCharacterId ? findCharacter(ui.editCharacterId) : null;
    if (character) return renderCharacterEditor(character);
    if (ui.editCharacterId) ui.editCharacterId = null;
    return renderPresetList();
}

function renderConstructorView() {
    const prompts = settings.constructor.prompts;
    return `<section class="ccm-section-head"><div><small>Дополнительно</small><h3>Общий конструктор</h3></div><label class="checkbox_label"><input id="ccm-constructor-enabled" type="checkbox" ${settings.constructor.enabled ? 'checked' : ''}><span>Включён</span></label></section>
        <small class="ccm-help">Эти промпты работают во всех чатах вместе с активными персонажами.</small>
        <select class="text_pole" id="ccm-starter-select"><option value="">Добавить заготовку из старого менеджера…</option>${STARTER_PROMPTS.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('')}</select>
        <div class="ccm-stack">${prompts.map(prompt => promptRowHtml(prompt, 'constructor')).join('') || emptyHtml('Конструктор пуст', 'Добавь свой промпт или выбери заготовку выше.')}</div>
        <button class="menu_button ccm-wide" data-action="add-constructor-prompt"><i class="fa-solid fa-plus"></i> Свой промпт</button>`;
}

function render() {
    if (!settings) return;
    const count = activeAssignmentCount();
    const floating = currentFloatingSettings();
    $('#ccm-count').text(count || '');
    $('#ccm-mini small').text(count || '');
    $('#ccm-mini').toggleClass('active', count > 0).toggle(floating.visible);
    $('#ccm-master-enabled').prop('checked', settings.enabled);
    $('#ccm-show-floating').prop('checked', floating.visible);
    $('.ccm-nav [data-view]').removeClass('active').filter(`[data-view="${ui.view}"]`).addClass('active');
    const html = ui.view === 'presets' ? renderPresetsView() : ui.view === 'constructor' ? renderConstructorView() : renderChatView();
    $('#ccm-content').html(html);
    if (floating.visible) globalThis.requestAnimationFrame?.(applyFloatingButtonPosition);
}

function showPanel() {
    if (managerPopup) return;
    managerPopup = new Popup(panelHtml(), POPUP_TYPE.DISPLAY, '', {
        leftAlign: true,
        allowVerticalScrolling: false,
        onOpen: () => render(),
        onClose: () => { managerPopup = null; },
    });
    void managerPopup.show();
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

async function openPromptEditor(prompt, persist = true) {
    const suffix = prompt.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const fieldIds = {
        label: `ccm-popup-label-${suffix}`,
        strength: `ccm-popup-strength-${suffix}`,
        chance: `ccm-popup-chance-${suffix}`,
        enabled: `ccm-popup-enabled-${suffix}`,
    };
    const popup = new Popup(
        `<h3>${escapeHtml(prompt.label || 'Новый промпт')}</h3><small>Опиши, что должен учитывать AI. Можно использовать {{char}} и {{user}}.</small>`,
        POPUP_TYPE.INPUT,
        prompt.text,
        {
            rows: 8,
            wide: true,
            okButton: 'Сохранить',
            cancelButton: 'Отмена',
            customInputs: [
                { id: fieldIds.label, label: 'Короткое название', type: 'text', defaultState: prompt.label },
                { id: fieldIds.strength, label: 'Сила от 1 до 10', type: 'number', min: 1, max: 10, step: 1, defaultState: prompt.strength },
                { id: fieldIds.chance, label: 'Частота от 0 до 100%', type: 'number', min: 0, max: 100, step: 5, defaultState: prompt.chance },
                { id: fieldIds.enabled, label: 'Активен', type: 'checkbox', defaultState: prompt.enabled },
            ],
        },
    );
    const text = await popup.show();
    if (typeof text !== 'string') return false;

    const inputResults = popup.inputResults;
    prompt.text = text;
    prompt.label = inputResults
        ? String(inputResults.get(fieldIds.label) || '').trim().slice(0, 120) || 'Без названия'
        : prompt.label;
    prompt.strength = inputResults ? clampNumber(inputResults.get(fieldIds.strength), 1, 10, prompt.strength) : prompt.strength;
    prompt.chance = inputResults ? clampNumber(inputResults.get(fieldIds.chance), 0, 100, prompt.chance) : prompt.chance;
    prompt.enabled = inputResults && typeof inputResults.get(fieldIds.enabled) === 'boolean'
        ? inputResults.get(fieldIds.enabled)
        : prompt.enabled;
    if (persist) {
        commitSettings();
        clearInjectedPrompt();
        render();
    }
    return true;
}

async function createPrompt(list, defaults) {
    const prompt = normalizePrompt(defaults);
    if (!await openPromptEditor(prompt, false)) return;
    list.push(prompt);
    commitSettings();
    clearInjectedPrompt();
    render();
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
    bindFloatingButton();
    $(document).on('click.ccm', '[data-view]', function () {
        ui.view = this.dataset.view;
        ui.editCharacterId = null;
        render();
    });
    $(document).on('click.ccm', '[data-action="open"]', showPanel);
    $('#ccm-master-enabled').on('change.ccm', function () {
        settings.enabled = this.checked;
        commitSettings();
        clearInjectedPrompt();
        render();
    });
    $('#ccm-show-floating').on('change.ccm', function () {
        currentFloatingSettings().visible = this.checked;
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
    $(document).on('click.ccm', '[data-action="delete-character"]', async function () {
        const character = findCharacter(this.dataset.characterId);
        if (!character) return;
        const confirmed = await Popup.show.confirm(
            'Удалить персонажа?',
            `Пресет «${escapeHtml(character.name)}» будет удалён и откреплён от текущего чата.`,
            { okButton: 'Удалить', cancelButton: 'Отмена' },
        );
        if (!confirmed) return;
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
    $(document).on('click.ccm', '[data-action="add-prompt"]', async function () {
        const character = findCharacter(ui.editCharacterId);
        if (!character) return;
        await createPrompt(character.modes[ui.editMode], { label: 'Новый промпт', text: '', chance: 70, strength: 5 });
    });
    $(document).on('click.ccm', '[data-action="attach"]', function () {
        const characterId = String($('#ccm-attach-select').val() || '');
        const chatState = getChatState();
        if (!chatState || !findCharacter(characterId)) return;
        if (!chatState.assignments.some(item => item.characterId === characterId)) {
            chatState.assignments.push({ characterId, enabled: false, mode: 'flirt' });
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
    $(document).on('change.ccm', '[data-action="toggle-character"]', function () {
        const chatState = getChatState(false);
        const assignment = chatState?.assignments.find(item => item.characterId === this.dataset.characterId);
        if (!assignment) return;
        assignment.enabled = this.checked;
        saveChatState();
        clearInjectedPrompt();
        render();
    });
    $(document).on('click.ccm', '[data-action="set-mode"]', function () {
        const chatState = getChatState(false);
        const assignment = chatState?.assignments.find(item => item.characterId === this.dataset.characterId);
        if (!assignment) return;
        assignment.mode = MODES.includes(this.dataset.mode) ? this.dataset.mode : 'flirt';
        saveChatState();
        clearInjectedPrompt();
        render();
    });
    $(document).on('change.ccm', '#ccm-constructor-enabled', function () {
        settings.constructor.enabled = this.checked;
        commitSettings();
        clearInjectedPrompt();
    });
    $(document).on('click.ccm', '[data-action="add-constructor-prompt"]', async function () {
        await createPrompt(settings.constructor.prompts, { label: 'Новый общий промпт', text: '', chance: 70, strength: 5 });
    });
    $(document).on('change.ccm', '#ccm-starter-select', async function () {
        const id = String(this.value || '');
        this.value = '';
        const starter = STARTER_PROMPTS.find(item => item.id === id);
        if (!starter) return;
        await createPrompt(settings.constructor.prompts, { label: starter.label, text: starter.text, chance: 70, strength: 6 });
    });
    $(document).on('change.ccm', '.ccm-prompt-row [data-field="enabled"]', function () {
        const card = this.closest('.ccm-prompt-row');
        const prompt = findPromptFromCard(card);
        if (!prompt) return;
        prompt.enabled = this.checked;
        card.classList.toggle('disabled', !prompt.enabled);
        commitSettings();
        clearInjectedPrompt();
    });
    $(document).on('click.ccm', '[data-action="edit-prompt"]', async function () {
        const card = this.closest('.ccm-prompt-row');
        const prompt = findPromptFromCard(card);
        if (prompt) await openPromptEditor(prompt);
    });
    $(document).on('click.ccm', '[data-action="delete-prompt"]', function () {
        const card = this.closest('.ccm-prompt-row');
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
        console.log('[Character Chemistry] v2.3.1 ready');
    } catch (error) {
        console.error('[Character Chemistry] Failed to initialize:', error);
        notify('Расширение не загрузилось. Подробности — в консоли.', 'error');
    }
});
