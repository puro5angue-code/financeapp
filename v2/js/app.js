/**
 * Finance OS - State Persistence & Management Engine
 * Flexible Incomes with One-Off / Irregular Income Support & Dynamic Debt Fields by Type
 */

var STORAGE_KEY = 'finance_os_app_data_v2';

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}
var escapeHtml = escapeHTML;

function debounce(func, wait = 150) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

var EXPENSE_CATEGORY_NAMES = {
    housing: '🏠 Жилье и ЖКХ',
    food: '🛒 Продукты и Еда',
    transport: '🚗 Транспорт и Авто',
    services: '📱 Связь и Подписки',
    health: '💊 Здоровье и Аптека',
    life: '👕 Быт и Покупки',
    hobby: '🎈 Развлечения',
    other: '📦 Прочее'
};

var DEBT_TYPE_NAMES = {
    card: '💳 Кредитная карта',
    credit: '🏦 Потребкредит',
    auto_mortgage: '🚗 Ипотека / Авто',
    personal: '🤝 Долг человеку / Займ'
};

// FEAT-4 FIX: Use actual today as default start date instead of hardcoded 05.08.2026
const _today = new Date();

var DEFAULT_DATA = {
    cash: 8000,
    strategy: 'avalanche', // 'avalanche' | 'snowball'
    horizonMonths: 24,     // FEAT-C: configurable simulation horizon
    startDate: { day: _today.getDate(), monthIdx: _today.getMonth(), year: _today.getFullYear() },
    incomes: [
        {
            id: 1,
            name: 'Зарплата МегаФон',
            category: 'salary',
            amount: 48253,
            enabled: true,
            frequency: 'monthly',
            scheduleType: 'split',
            advanceDay: '10-е число',
            advanceAmount: 24126,
            mainDay: '25-е число',
            mainAmount: 24127,
            day: '10-е (Аванс: 24.1k ₽) и 25-е (24.1k ₽)'
        },
        {
            id: 2,
            name: 'Фриланс / Подработка',
            category: 'freelance',
            amount: 26000,
            enabled: true,
            frequency: 'monthly',
            scheduleType: 'flexible',
            day: 'В течение месяца'
        },
        {
            id: 3,
            name: 'Прочие поступления',
            category: 'other',
            amount: 11000,
            enabled: true,
            frequency: 'monthly',
            scheduleType: 'single',
            singleDay: '20-е число',
            singleAmount: 11000,
            day: '20-е число'
        }
    ],
    expenses: [
        { id: 1, name: 'ЖКХ и коммуналка', category: 'housing', amount: 5000, day: '15-е число', enabled: true, frequency: 'monthly' },
        { id: 2, name: 'Продукты и супермаркеты', category: 'food', amount: 20000, day: 'В течение месяца', enabled: true, frequency: 'monthly' },
        { id: 3, name: 'Связь, интернет и подписки', category: 'services', amount: 1500, day: '28-е число', enabled: true, frequency: 'monthly' },
        { id: 4, name: 'Аренда жилья', category: 'housing', amount: 14000, day: '1-е число', enabled: true, frequency: 'monthly' }
    ],
    debts: [
        { id: 1, name: 'Альфа-Банк 100 дней', type: 'card', amount: 9998, limit: 50000, rate: 30.0, minPay: 1000, grace: '15.10.2026', dueDate: '15-е число' },
        { id: 2, name: 'Т-Банк Платинум', type: 'card', amount: 34765, limit: 100000, rate: 35.0, minPay: 1500, grace: '05.11.2026', dueDate: '05-е число' },
        { id: 3, name: 'Сбербанк Кредитная', type: 'card', amount: 186050, limit: 200000, rate: 25.4, minPay: 5582, grace: 'Нет', dueDate: '25-е число' }
    ],
    savingsGoals: [
        { id: 1, name: '🛡️ Подушка безопасности', target: 300000, color: 'linear-gradient(90deg, #3b82f6, #2563eb)' },
        { id: 2, name: '🚗 Автомобиль', target: 800000, color: 'linear-gradient(90deg, #a855f7, #9333ea)' }
    ]
};

var appData = loadAppData();
let editingDebtId = null;
let editingIncomeId = null;   // FEAT-A
let editingExpenseId = null;  // FEAT-A

function loadAppData() {
    try {
        let saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            saved = localStorage.getItem('finance_os_app_data');
        }
        if (!saved) {
            saved = localStorage.getItem('finance_app_data');
        }
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!parsed.executedItems) parsed.executedItems = {};
            if (!parsed.excludedItems) parsed.excludedItems = {};
            if (!parsed.customAmounts) parsed.customAmounts = {};
            if (typeof parsed.cash !== 'number' || isNaN(parsed.cash)) {

                parsed.cash = DEFAULT_DATA.cash;
            }
            if (!parsed.strategy) parsed.strategy = DEFAULT_DATA.strategy;
            // FEAT-C: normalize horizonMonths
            if (!parsed.horizonMonths || parsed.horizonMonths < 1) parsed.horizonMonths = 24;
            if (!parsed.savingsGoals || !Array.isArray(parsed.savingsGoals)) {
                parsed.savingsGoals = DEFAULT_DATA.savingsGoals;
            }
            if (!parsed.startDate) parsed.startDate = DEFAULT_DATA.startDate;
            if (!Array.isArray(parsed.incomes)) parsed.incomes = DEFAULT_DATA.incomes;
            if (!Array.isArray(parsed.expenses)) parsed.expenses = DEFAULT_DATA.expenses;
            if (!Array.isArray(parsed.debts)) parsed.debts = DEFAULT_DATA.debts;

            parsed.incomes.forEach(i => {
                if (!i.frequency) i.frequency = 'monthly';
                if (i.amount === undefined || isNaN(Number(i.amount))) i.amount = 0;
            });
            parsed.expenses.forEach(e => {
                if (!e.category) e.category = 'other';
                if (e.enabled === undefined) e.enabled = true;
                if (!e.day) e.day = 'В течение месяца';
                if (!e.frequency) e.frequency = 'monthly';
                if (e.amount === undefined || isNaN(Number(e.amount))) e.amount = 0;
            });
            parsed.debts.forEach(d => {
                if (!d.type) d.type = 'card';
                if (!d.dueDate) d.dueDate = '25-е число';
                if (d.allowBuffer === undefined) d.allowBuffer = (d.type === 'card');
                if (d.strictGrace === undefined) d.strictGrace = false;
                if (!d.graceDays) d.graceDays = 55;
                // FEAT-7: Normalize termMonths for existing debts
                if (d.termMonths === undefined || d.termMonths === null) d.termMonths = 0;
                if (!d.startMonth) d.startMonth = null;
                if (d.amount === undefined || isNaN(Number(d.amount))) d.amount = 0;
                if (d.limit === undefined || isNaN(Number(d.limit))) d.limit = 0;
                if (d.rate === undefined || isNaN(Number(d.rate))) d.rate = 0;
                if (d.minPay === undefined || isNaN(Number(d.minPay))) d.minPay = 0;
            });

            return parsed;
        }
    } catch (e) {
        console.error('Ошибка загрузки данных из LocalStorage:', e);
    }
    const defaultDataCopy = JSON.parse(JSON.stringify(DEFAULT_DATA));
    defaultDataCopy.executedItems = {};
    defaultDataCopy.excludedItems = {};
    return defaultDataCopy;
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.error('Ошибка сохранения данных:', e);
    }
}

function resetToDefault() {
    if (confirm('Вы уверены, что хотите сбросить все данные к исходным?')) {
        appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
        // BUG-14 FIX: Also reset executedItems and excludedItems (not in DEFAULT_DATA)
        appData.executedItems = {};
        appData.excludedItems = {};
        appData.customAmounts = {};
        saveData();
        recalculateApp();
    }
}

// FEAT-B: Cash Balance Modal (replaces prompt())
function openCashModal() {
    const input = document.getElementById('cashInput');
    if (input) input.value = appData.cash;
    openModal('cashModal');
}

function saveCashBalance(event) {
    event.preventDefault();
    const input = document.getElementById('cashInput');
    const num = parseFloat(input ? input.value : 0);
    if (!isNaN(num) && num >= 0) {
        appData.cash = num;
        saveData();
        closeModal('cashModal');
        recalculateApp();
    } else {
        if (input) { input.classList.add('input-error'); input.title = 'Введите корректное неотрицательное число'; }
    }
}

// Legacy alias (kept for backward compat)
function updateCashBalance() { openCashModal(); }

// FEAT-C: Simulation Horizon Handler
function setHorizonMonths(months) {
    appData.horizonMonths = parseInt(months) || 24;
    saveData();
    recalculateApp();
}

// Strategy Toggle Handler
function setStrategy(newStrategy) {
    appData.strategy = newStrategy;
    saveData();
    recalculateApp();
}

// Tab Switching Handler
function switchTab(tabId, btnElem) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    if (btnElem) btnElem.classList.add('active');

    if (tabId === 'dashboardTab') {
        setTimeout(() => {
            if (typeof debtChartInstance !== 'undefined' && debtChartInstance) debtChartInstance.resize();
            if (typeof structChartInstance !== 'undefined' && structChartInstance) structChartInstance.resize();
        }, 50);
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        if (modalId === 'incomeModal') {
            populateOneOffMonthDropdown();
        } else if (modalId === 'expenseModal') {
            populateExpenseOneOffMonthDropdown();
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function populateOneOffMonthDropdown() {
    const select = document.getElementById('incOneOffMonthSelect');
    if (!select) return;

    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    let html = '';
    // WEAK-1 FIX: Use actual appData.startDate instead of hardcoded 2026/August
    const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : new Date().getFullYear();
    const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : new Date().getMonth();

    for (let i = 0; i < 24; i++) {
        const mIdx = (startMonth + i) % 12;
        const y = startYear + Math.floor((startMonth + i) / 12);
        const label = `${monthsRu[mIdx]} ${y}`;
        html += `<option value="${label}">${label}</option>`;
    }
    select.innerHTML = html;
}

// Income Handlers
let currentIncomeScheduleType = 'split'; // 'split' | 'single' | 'flexible'
let currentIncomeFrequency = 'monthly'; // 'monthly' | 'one_off'

function setIncomeFrequency(freq) {
    currentIncomeFrequency = freq;
    document.querySelectorAll('.freq-btn').forEach(btn => {
        if (btn.dataset.freq === freq) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const monthBox = document.getElementById('incOneOffMonthBox');
    if (monthBox) monthBox.style.display = freq === 'one_off' ? 'block' : 'none';
}

function setIncomeScheduleType(type) {
    currentIncomeScheduleType = type;
    document.querySelectorAll('.schedule-type-btn').forEach(btn => {
        if (btn.dataset.type === type) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const splitBox = document.getElementById('incSplitDetailsBox');
    const singleBox = document.getElementById('incSingleDetailsBox');
    const flexBox = document.getElementById('incFlexDetailsBox');

    if (splitBox) splitBox.style.display = type === 'split' ? 'block' : 'none';
    if (singleBox) singleBox.style.display = type === 'single' ? 'block' : 'none';
    if (flexBox) flexBox.style.display = type === 'flexible' ? 'block' : 'none';

    updateIncomeTotalDisplay();
}

function updateIncomeTotalDisplay() {
    const totalElem = document.getElementById('incTotalPreview');
    if (!totalElem) return;

    let total = 0;
    if (currentIncomeScheduleType === 'split') {
        const adv = parseFloat(document.getElementById('incAdvanceAmount')?.value) || 0;
        const main = parseFloat(document.getElementById('incMainAmount')?.value) || 0;
        total = adv + main;
    } else if (currentIncomeScheduleType === 'single') {
        total = parseFloat(document.getElementById('incSingleAmount')?.value) || 0;
    } else {
        total = parseFloat(document.getElementById('incFlexAmount')?.value) || 0;
    }

    totalElem.innerText = total.toLocaleString('ru-RU') + ' ₽';
}

// FEAT-A: Open Income Modal for Add or Edit
function openIncomeModal(id = null) {
    editingIncomeId = id;
    populateOneOffMonthDropdown();
    const title = document.getElementById('incomeModalTitle');
    if (id) {
        const inc = appData.incomes.find(i => i.id === id);
        if (!inc) return;
        if (title) title.innerText = '✏️ Редактировать доход';
        document.getElementById('incName').value = inc.name || '';
        const catSel = document.getElementById('incCategory');
        if (catSel) catSel.value = inc.category || 'other';
        // Set frequency
        setIncomeFrequency(inc.frequency || 'monthly');
        // Set oneOffMonth
        const oneOffSel = document.getElementById('incOneOffMonthSelect');
        if (oneOffSel && inc.oneOffMonth) oneOffSel.value = inc.oneOffMonth;
        // Set schedule type and fill details
        setIncomeScheduleType(inc.scheduleType || 'flexible');
        if (inc.scheduleType === 'split') {
            document.getElementById('incAdvanceDay').value = inc.advanceDay || '10-е число';
            document.getElementById('incAdvanceAmount').value = inc.advanceAmount || 0;
            document.getElementById('incMainDay').value = inc.mainDay || '25-е число';
            document.getElementById('incMainAmount').value = inc.mainAmount || 0;
        } else if (inc.scheduleType === 'single') {
            document.getElementById('incSingleDay').value = inc.singleDay || '20-е число';
            document.getElementById('incSingleAmount').value = inc.singleAmount || inc.amount || 0;
        } else {
            document.getElementById('incFlexDay').value = inc.day || 'В течение месяца';
            document.getElementById('incFlexAmount').value = inc.amount || 0;
        }
        updateIncomeTotalDisplay();
    } else {
        if (title) title.innerText = '➕ Добавить источник дохода';
        const form = document.getElementById('incomeForm');
        if (form) form.reset();
        setIncomeFrequency('monthly');
        setIncomeScheduleType('split');
        updateIncomeTotalDisplay();
    }
    openModal('incomeModal');
}

function saveIncome(event) {
    event.preventDefault();
    const name = document.getElementById('incName').value.trim();
    const category = document.getElementById('incCategory').value;
    const frequency = currentIncomeFrequency;
    const oneOffMonth = document.getElementById('incOneOffMonthSelect') ? document.getElementById('incOneOffMonthSelect').value : 'Август 2026';

    let totalAmount = 0;
    let dayText = 'В течение месяца';
    let advanceDay = '', advanceAmount = 0, mainDay = '', mainAmount = 0, singleDay = '', singleAmount = 0;

    if (currentIncomeScheduleType === 'split') {
        advanceDay = document.getElementById('incAdvanceDay').value.trim() || '10-е число';
        advanceAmount = parseFloat(document.getElementById('incAdvanceAmount').value) || 0;
        mainDay = document.getElementById('incMainDay').value.trim() || '25-е число';
        mainAmount = parseFloat(document.getElementById('incMainAmount').value) || 0;
        totalAmount = advanceAmount + mainAmount;

        const advK = advanceAmount >= 1000 ? (advanceAmount / 1000).toFixed(1) + 'k' : advanceAmount;
        const mainK = mainAmount >= 1000 ? (mainAmount / 1000).toFixed(1) + 'k' : mainAmount;
        dayText = `${advanceDay} (${advK} ₽) и ${mainDay} (${mainK} ₽)`;
    } else if (currentIncomeScheduleType === 'single') {
        singleDay = document.getElementById('incSingleDay').value.trim() || '20-е число';
        singleAmount = parseFloat(document.getElementById('incSingleAmount').value) || 0;
        totalAmount = singleAmount;
        dayText = `${singleDay}`;
    } else {
        totalAmount = parseFloat(document.getElementById('incFlexAmount').value) || 0;
        dayText = document.getElementById('incFlexDay').value.trim() || 'В течение месяца';
    }

    if (name && totalAmount >= 0) {
        const incomeData = {
            name, category, amount: totalAmount, frequency,
            oneOffMonth: frequency === 'one_off' ? oneOffMonth : null,
            scheduleType: currentIncomeScheduleType,
            advanceDay, advanceAmount, mainDay, mainAmount,
            singleDay, singleAmount, day: dayText
        };
        if (editingIncomeId) {
            // FEAT-A: Edit mode — update existing
            const idx = appData.incomes.findIndex(i => i.id === editingIncomeId);
            if (idx !== -1) {
                appData.incomes[idx] = { ...appData.incomes[idx], ...incomeData };
            }
            editingIncomeId = null;
        } else {
            // Add mode
            appData.incomes.push({ id: Date.now(), enabled: true, ...incomeData });
        }
        saveData();
        closeModal('incomeModal');
        recalculateApp();
        event.target.reset();
    }
}

function toggleIncome(id) {
    const inc = appData.incomes.find(i => i.id === id);
    if (inc) {
        inc.enabled = inc.enabled === false ? true : false;
        saveData();
        recalculateApp();
    }
}

function updateIncomeField(id, field, val) {
    const inc = appData.incomes.find(i => i.id === id);
    if (inc) {
        if (field === 'amount') {
            const newTotal = Math.max(0, parseFloat(val) || 0);
            inc.amount = newTotal;
            if (inc.scheduleType === 'split') {
                inc.advanceAmount = Math.floor(newTotal / 2);
                inc.mainAmount = Math.ceil(newTotal / 2);
                const advK = inc.advanceAmount >= 1000 ? (inc.advanceAmount / 1000).toFixed(1) + 'k' : inc.advanceAmount;
                const mainK = inc.mainAmount >= 1000 ? (inc.mainAmount / 1000).toFixed(1) + 'k' : inc.mainAmount;
                inc.day = `${inc.advanceDay || '10-е число'} (${advK} ₽) и ${inc.mainDay || '25-е число'} (${mainK} ₽)`;
            } else if (inc.scheduleType === 'single') {
                inc.singleAmount = newTotal;
            }
        } else {
            inc[field] = val;
        }
        saveData();
        recalculateApp();
    }
}

function deleteIncome(id) {
    if (confirm('Удалить этот источник дохода?')) {
        appData.incomes = appData.incomes.filter(i => i.id !== id);
        saveData();
        recalculateApp();
    }
}

function duplicateIncome(id) {
    const inc = appData.incomes.find(i => i.id === id);
    if (inc) {
        appData.incomes.push({
            ...JSON.parse(JSON.stringify(inc)),
            id: Date.now(),
            name: inc.name + ' (Копия)'
        });
        saveData();
        recalculateApp();
    }
}

function addIncomePreset(catKey) {
    const presets = {
        salary: { name: '💼 Зарплата (Оклад + Аванс)', category: 'salary', amount: 50000, frequency: 'monthly', scheduleType: 'split', advanceDay: '10-е число', advanceAmount: 25000, mainDay: '25-е число', mainAmount: 25000, day: '10-е (25k ₽) и 25-е (25k ₽)' },
        vacation: { name: '🌴 Отпускные (Разово)', category: 'bonus', amount: 45000, frequency: 'one_off', oneOffMonth: 'Август 2026', scheduleType: 'single', singleDay: '05-е число', singleAmount: 45000, day: '05-е число (Разово)' },
        bonus: { name: '🎁 Ежемесячная Премия', category: 'bonus', amount: 15000, frequency: 'monthly', scheduleType: 'single', singleDay: '25-е число', singleAmount: 15000, day: '25-е число' },
        freelance: { name: '💻 Подработка / Заказ', category: 'freelance', amount: 20000, frequency: 'monthly', scheduleType: 'flexible', day: 'В течение месяца' },
        passive: { name: '📈 Проценты по вкладу', category: 'passive', amount: 5000, frequency: 'monthly', scheduleType: 'single', singleDay: '1-е число', singleAmount: 5000, day: '1-е число' }
    };

    if (presets[catKey]) {
        appData.incomes.push({
            id: Date.now(),
            enabled: true,
            ...presets[catKey]
        });
        saveData();
        recalculateApp();
    }
}

// Expense Handlers
let currentExpenseFrequency = 'monthly'; // 'monthly' | 'one_off'

function setExpenseFrequency(freq) {
    currentExpenseFrequency = freq;
    document.querySelectorAll('.exp-freq-btn').forEach(btn => {
        if (btn.dataset.freq === freq) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const monthBox = document.getElementById('expOneOffMonthBox');
    if (monthBox) monthBox.style.display = freq === 'one_off' ? 'block' : 'none';
}

function populateExpenseOneOffMonthDropdown() {
    const select = document.getElementById('expOneOffMonthSelect');
    if (!select) return;

    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    let html = '';
    const startYear = (appData.startDate && appData.startDate.year) || 2026;
    const startMonth = (appData.startDate && appData.startDate.monthIdx) || 7;

    for (let i = 0; i < 24; i++) {
        const mIdx = (startMonth + i) % 12;
        const y = startYear + Math.floor((startMonth + i) / 12);
        const label = `${monthsRu[mIdx]} ${y}`;
        html += `<option value="${label}">${label}</option>`;
    }
    select.innerHTML = html;
}

// FEAT-A: Open Expense Modal for Add or Edit
function openExpenseModal(id = null) {
    editingExpenseId = id;
    populateExpenseOneOffMonthDropdown();
    const title = document.getElementById('expenseModalTitle');
    if (id) {
        const exp = appData.expenses.find(e => e.id === id);
        if (!exp) return;
        if (title) title.innerText = '✏️ Редактировать расход';
        document.getElementById('expName').value = exp.name || '';
        const catSel = document.getElementById('expCategory');
        if (catSel) catSel.value = exp.category || 'other';
        setExpenseFrequency(exp.frequency || 'monthly');
        const oneOffSel = document.getElementById('expOneOffMonthSelect');
        if (oneOffSel && exp.oneOffMonth) oneOffSel.value = exp.oneOffMonth;
        document.getElementById('expAmount').value = exp.amount || 0;
        document.getElementById('expDay').value = exp.day || 'В течение месяца';
    } else {
        if (title) title.innerText = '🛍️ Добавить статью расхода';
        const form = document.getElementById('expenseForm');
        if (form) form.reset();
        setExpenseFrequency('monthly');
    }
    openModal('expenseModal');
}

function saveExpense(event) {
    event.preventDefault();
    const name = document.getElementById('expName').value.trim();
    const category = document.getElementById('expCategory').value;
    const amount = parseFloat(document.getElementById('expAmount').value);
    const day = document.getElementById('expDay').value.trim() || 'В течение месяца';
    const frequency = currentExpenseFrequency;
    const oneOffMonth = document.getElementById('expOneOffMonthSelect') ? document.getElementById('expOneOffMonthSelect').value : 'Август 2026';

    if (name && !isNaN(amount) && amount >= 0) {
        const expData = { name, category, amount, day, frequency, oneOffMonth: frequency === 'one_off' ? oneOffMonth : null };
        if (editingExpenseId) {
            // FEAT-A: Edit mode — update existing
            const idx = appData.expenses.findIndex(e => e.id === editingExpenseId);
            if (idx !== -1) {
                appData.expenses[idx] = { ...appData.expenses[idx], ...expData };
            }
            editingExpenseId = null;
        } else {
            appData.expenses.push({ id: Date.now(), enabled: true, ...expData });
        }
        saveData();
        closeModal('expenseModal');
        recalculateApp();
        event.target.reset();
    }
}

// Start Date Picker Handlers
function openStartDateModal() {
    populateStartMonthYearDropdown();
    const dayInput = document.getElementById('startDayInput');
    if (dayInput) dayInput.value = (appData.startDate && appData.startDate.day) || 5;

    const monthSelect = document.getElementById('startMonthYearSelect');
    if (monthSelect) {
        const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const curM = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;
        const curY = (appData.startDate && appData.startDate.year) || 2026;
        monthSelect.value = `${monthsRu[curM]} ${curY}`;
    }
    openModal('startDateModal');
}

function populateStartMonthYearDropdown() {
    const select = document.getElementById('startMonthYearSelect');
    if (!select) return;

    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    let html = '';
    for (let y = 2026; y <= 2030; y++) {
        for (let m = 0; m < 12; m++) {
            const label = `${monthsRu[m]} ${y}`;
            html += `<option value="${label}">${label}</option>`;
        }
    }
    select.innerHTML = html;
}

function saveStartDate(event) {
    event.preventDefault();
    const day = parseInt(document.getElementById('startDayInput').value, 10) || 1;
    const monthYearVal = document.getElementById('startMonthYearSelect').value;

    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const parts = monthYearVal.split(' ');
    const mIdx = monthsRu.indexOf(parts[0]);
    const year = parseInt(parts[1], 10);

    if (mIdx !== -1 && !isNaN(year)) {
        appData.startDate = { day, monthIdx: mIdx, year };
        saveData();
        closeModal('startDateModal');
        recalculateApp();
    }
}

function toggleExpense(id) {
    const exp = appData.expenses.find(e => e.id === id);
    if (exp) {
        exp.enabled = exp.enabled === false ? true : false;
        saveData();
        recalculateApp();
    }
}

function updateExpenseField(id, field, val) {
    const exp = appData.expenses.find(e => e.id === id);
    if (exp) {
        if (field === 'amount') exp.amount = Math.max(0, parseFloat(val) || 0);
        else exp[field] = val;
        saveData();
        recalculateApp();
    }
}

function deleteExpense(id) {
    if (confirm('Удалить эту статью расхода?')) {
        appData.expenses = appData.expenses.filter(e => e.id !== id);
        saveData();
        recalculateApp();
    }
}

function duplicateExpense(id) {
    const exp = appData.expenses.find(e => e.id === id);
    if (exp) {
        appData.expenses.push({
            ...JSON.parse(JSON.stringify(exp)),
            id: Date.now(),
            name: exp.name + ' (Копия)'
        });
        saveData();
        recalculateApp();
    }
}

function addExpensePreset(catKey) {
    const presets = {
        housing: { name: '🏠 ЖКХ и коммуналка', category: 'housing', amount: 5000, day: '15-е число', frequency: 'monthly', enabled: true },
        food: { name: '🛒 Продукты и супермаркеты', category: 'food', amount: 20000, day: 'В течение месяца', frequency: 'monthly', enabled: true },
        transport: { name: '🚗 Проезд и Топливо', category: 'transport', amount: 4000, day: 'В течение месяца', frequency: 'monthly', enabled: true },
        services: { name: '📱 Связь и Подписки', category: 'services', amount: 1500, day: '28-е число', frequency: 'monthly', enabled: true }
    };

    if (presets[catKey]) {
        appData.expenses.push({
            id: Date.now(),
            enabled: true,
            ...presets[catKey]
        });
        saveData();
        recalculateApp();
    }
}

// Pro Debt Portfolio Handlers & Dynamic Type Adapter
function onDebtTypeChange() {
    const typeSelect = document.getElementById('debtType');
    if (!typeSelect) return;

    const selectedType = typeSelect.value;
    const limitGroup = document.getElementById('debtLimitGroup');
    const graceGroup = document.getElementById('debtGraceGroup');
    const bufferGroup = document.getElementById('debtBufferGroup');
    const termGroup = document.getElementById('debtTermGroup');  // FEAT-7
    const startMonthGroup = document.getElementById('debtStartMonthGroup'); // Future Debt Start Month
    const minPayLabel = document.getElementById('debtMinPayLabel');
    const rateLabel = document.getElementById('debtRateLabel');

    if (selectedType === 'card') {
        if (limitGroup) limitGroup.style.display = 'block';
        if (graceGroup) graceGroup.style.display = 'block';
        if (bufferGroup) bufferGroup.style.display = 'block';
        if (termGroup) termGroup.style.display = 'none';
        if (startMonthGroup) startMonthGroup.style.display = 'none';
        if (minPayLabel) minPayLabel.innerText = 'Мин. обязательный платеж (₽/мес)';
        if (rateLabel) rateLabel.innerText = 'Процентная ставка (% годовых)';
    } else if (selectedType === 'credit' || selectedType === 'auto_mortgage') {
        if (limitGroup) limitGroup.style.display = 'none';
        if (graceGroup) graceGroup.style.display = 'none';
        if (bufferGroup) bufferGroup.style.display = 'none';
        // FEAT-7: Show term group for credit and mortgage
        if (termGroup) termGroup.style.display = 'block';
        if (startMonthGroup) startMonthGroup.style.display = 'block';
        if (minPayLabel) minPayLabel.innerText = 'Аннуитетный / Фиксированный платеж (₽/мес)';
        if (rateLabel) rateLabel.innerText = 'Процентная ставка (% годовых)';
    } else if (selectedType === 'personal') {
        if (limitGroup) limitGroup.style.display = 'none';
        if (graceGroup) graceGroup.style.display = 'none';
        if (bufferGroup) bufferGroup.style.display = 'none';
        if (termGroup) termGroup.style.display = 'none';
        if (startMonthGroup) startMonthGroup.style.display = 'block';
        if (minPayLabel) minPayLabel.innerText = 'Договорной / Посильный платеж (₽/мес)';
        if (rateLabel) rateLabel.innerText = 'Процентная ставка (% годовых, 0 если без %)';
    }
}

function populateDebtStartMonthDropdown() {
    const select = document.getElementById('debtStartMonthSelect');
    if (!select) return;

    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    let html = '<option value="">Сразу (Текущий месяц)</option>';

    const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : new Date().getFullYear();
    const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : new Date().getMonth();

    for (let i = 1; i <= 60; i++) {
        const mIdx = (startMonth + i) % 12;
        const y = startYear + Math.floor((startMonth + i) / 12);
        const label = `${monthsRu[mIdx]} ${y}`;
        html += `<option value="${label}">${label}</option>`;
    }
    select.innerHTML = html;
}

function openDebtModal(id = null) {
    editingDebtId = id;
    populateDebtStartMonthDropdown();
    const titleElem = document.getElementById('debtModalTitle');
    
    if (id) {
        const debt = appData.debts.find(d => d.id === id);
        if (debt) {
            if (titleElem) titleElem.innerText = '✏️ Редактировать кредитное обязательство';
            document.getElementById('debtName').value = debt.name;
            document.getElementById('debtType').value = debt.type || 'card';
            document.getElementById('debtAmount').value = debt.amount;
            document.getElementById('debtLimit').value = debt.limit || 0;
            document.getElementById('debtRate').value = debt.rate;
            document.getElementById('debtMin').value = debt.minPay || 0;
            document.getElementById('debtGrace').value = debt.grace || 'Нет';
            document.getElementById('debtDueDate').value = debt.dueDate || '25-е число';
            
            const bufferCheck = document.getElementById('debtAllowBuffer');
            if (bufferCheck) bufferCheck.checked = debt.allowBuffer !== false;

            const strictGraceCheck = document.getElementById('debtStrictGrace');
            if (strictGraceCheck) strictGraceCheck.checked = !!debt.strictGrace;

            const graceDaysInput = document.getElementById('debtGraceDays');
            if (graceDaysInput) graceDaysInput.value = debt.graceDays || 55;

            // FEAT-7: Populate term months field
            const termMonthsInput = document.getElementById('debtTermMonths');
            if (termMonthsInput) termMonthsInput.value = debt.termMonths || '';

            // Future Start Month
            const startMonthSel = document.getElementById('debtStartMonthSelect');
            if (startMonthSel) startMonthSel.value = debt.startMonth || '';

            // Show annuity preview if available
            if (debt.termMonths > 0 && debt.amount > 0) {
                const preview = document.getElementById('annuityPreview');
                if (preview) preview.innerText = `Аннуитет: ${calcAnnuity(debt.amount, debt.rate, debt.termMonths).toLocaleString('ru-RU')} ₽/мес × ${debt.termMonths} мес.`;
            } else {
                const preview = document.getElementById('annuityPreview');
                if (preview) preview.innerText = '';
            }
        }
    } else {
        if (titleElem) titleElem.innerText = '🚨 Добавить кредитное обязательство';
        const form = document.getElementById('debtForm');
        if (form) form.reset();
        document.getElementById('debtType').value = 'card';
        const bufferCheck = document.getElementById('debtAllowBuffer');
        if (bufferCheck) bufferCheck.checked = true;
        const strictGraceCheck = document.getElementById('debtStrictGrace');
        if (strictGraceCheck) strictGraceCheck.checked = false;
        const graceDaysInput = document.getElementById('debtGraceDays');
        if (graceDaysInput) graceDaysInput.value = 55;
        // FEAT-7: Reset term and preview
        const termMonthsInput = document.getElementById('debtTermMonths');
        if (termMonthsInput) termMonthsInput.value = '';
        const startMonthSel = document.getElementById('debtStartMonthSelect');
        if (startMonthSel) startMonthSel.value = '';
        const preview = document.getElementById('annuityPreview');
        if (preview) preview.innerText = '';
    }

    onDebtTypeChange();
    openModal('debtModal');
}

function saveDebt(event) {
    event.preventDefault();
    const name = document.getElementById('debtName').value.trim();
    const type = document.getElementById('debtType').value;
    const amount = parseFloat(document.getElementById('debtAmount').value);
    const limit = type === 'card' ? (parseFloat(document.getElementById('debtLimit').value) || 0) : 0;
    const rate = parseFloat(document.getElementById('debtRate').value) || 0;
    let minPay = parseFloat(document.getElementById('debtMin').value) || 0;
    const grace = type === 'card' ? (document.getElementById('debtGrace').value.trim() || 'Нет') : 'Нет';
    const dueDate = document.getElementById('debtDueDate').value.trim() || '25-е число';
    
    const bufferCheck = document.getElementById('debtAllowBuffer');
    const allowBuffer = type === 'card' ? (bufferCheck ? bufferCheck.checked : true) : false;
    const strictGraceCheck = document.getElementById('debtStrictGrace');
    const strictGrace = type === 'card' ? (strictGraceCheck ? strictGraceCheck.checked : false) : false;
    const graceDaysInput = document.getElementById('debtGraceDays');
    const graceDays = type === 'card' ? (parseInt(graceDaysInput?.value, 10) || 55) : 55;

    // FEAT-7: Read term months and auto-calculate annuity if set
    const termMonthsEl = document.getElementById('debtTermMonths');
    const termMonths = (type === 'credit' || type === 'auto_mortgage') ? (parseInt(termMonthsEl?.value, 10) || 0) : 0;
    if (termMonths > 0 && amount > 0 && (type === 'credit' || type === 'auto_mortgage')) {
        const annuity = calcAnnuity(amount, rate, termMonths);
        if (annuity > 0 && minPay === 0) {
            minPay = annuity; // Auto-fill if user hasn't overridden
        }
    }

    const startMonthSel = document.getElementById('debtStartMonthSelect');
    const startMonth = type !== 'card' ? (startMonthSel ? (startMonthSel.value || null) : null) : null;

    if (name && !isNaN(amount)) {
        if (editingDebtId) {
            const debt = appData.debts.find(d => d.id === editingDebtId);
            if (debt) {
                debt.name = name;
                debt.type = type;
                debt.amount = amount;
                debt.limit = limit;
                debt.rate = rate;
                debt.minPay = minPay;
                debt.grace = grace;
                debt.dueDate = dueDate;
                debt.allowBuffer = allowBuffer;
                debt.strictGrace = strictGrace;
                debt.graceDays = graceDays;
                debt.termMonths = termMonths; // FEAT-7
                debt.startMonth = startMonth; // Future start month
            }
            editingDebtId = null;
        } else {
            appData.debts.push({ id: Date.now(), name, type, amount, limit, rate, minPay, grace, dueDate, allowBuffer, strictGrace, graceDays, termMonths, startMonth });
        }
        saveData();
        closeModal('debtModal');
        recalculateApp();
        event.target.reset();
    }
}

function updateDebtField(id, field, val) {
    const debt = appData.debts.find(d => d.id === id);
    if (debt) {
        if (field === 'amount' || field === 'limit' || field === 'rate' || field === 'minPay') {
            debt[field] = Math.max(0, parseFloat(val) || 0);
        } else if (field === 'termMonths') {
            // FEAT-7: When term changes, auto-recalculate annuity
            debt.termMonths = Math.max(0, parseInt(val) || 0);
            if (debt.termMonths > 0 && debt.amount > 0 && (debt.type === 'credit' || debt.type === 'auto_mortgage')) {
                debt.minPay = calcAnnuity(debt.amount, debt.rate, debt.termMonths);
            }
        } else {
            debt[field] = val;
        }
        saveData();
        recalculateApp();
    }
}

function toggleDebtBuffer(id) {
    const debt = appData.debts.find(d => d.id === id);
    if (debt) {
        debt.allowBuffer = debt.allowBuffer === false ? true : false;
        saveData();
        recalculateApp();
    }
}

function toggleDebtStrictGrace(id) {
    const debt = appData.debts.find(d => d.id === id);
    if (debt) {
        debt.strictGrace = !debt.strictGrace;
        saveData();
        recalculateApp();
    }
}

function updateDebtAmount(id, val) {
    updateDebtField(id, 'amount', val);
}

function deleteDebt(id) {
    if (confirm('Удалить это кредитное обязательство?')) {
        appData.debts = appData.debts.filter(d => d.id !== id);
        saveData();
        recalculateApp();
    }
}

function duplicateDebt(id) {
    const debt = appData.debts.find(d => d.id === id);
    if (debt) {
        appData.debts.push({
            ...JSON.parse(JSON.stringify(debt)),
            id: Date.now(),
            name: debt.name + ' (Копия)'
        });
        saveData();
        recalculateApp();
    }
}

function calcAnnuity(amount, rate, termMonths) {
    if (amount <= 0 || termMonths <= 0) return 0;
    if (rate <= 0) return Math.round(amount / termMonths);
    const r = rate / 100 / 12;
    const pmt = amount * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
    return Math.round(pmt);
}

function calculateAndFillMonthlyPayment() {
    const amount = parseFloat(document.getElementById('debtAmount')?.value) || 0;
    const rate = parseFloat(document.getElementById('debtRate')?.value) || 0;
    const termEl = document.getElementById('debtTermMonths');
    let termMonths = parseInt(termEl?.value, 10) || 0;

    if (amount <= 0) {
        alert('Пожалуйста, сначала введите сумму долга (остаток).');
        return;
    }

    if (termMonths <= 0) {
        const inputTerm = prompt('Укажите срок кредита в месяцах (например: 36, 48, 60):', '36');
        if (!inputTerm) return;
        termMonths = parseInt(inputTerm, 10) || 36;
        if (termEl) termEl.value = termMonths;
    }

    const pmt = calcAnnuity(amount, rate, termMonths);
    const minInput = document.getElementById('debtMin');
    if (minInput) minInput.value = pmt;

    const preview = document.getElementById('annuityPreview');
    if (preview) {
        preview.innerText = `✅ Рассчитан платеж: ${pmt.toLocaleString('ru-RU')} ₽/мес (${termMonths} мес. под ${rate}%)`;
    }
}

function autoCalcAnnuity() {
    const amount = parseFloat(document.getElementById('debtAmount').value) || 0;
    const rate = parseFloat(document.getElementById('debtRate').value) || 0;
    const termMonths = parseInt(document.getElementById('debtTermMonths').value, 10) || 0;
    const preview = document.getElementById('annuityPreview');
    const minInput = document.getElementById('debtMin');

    if (amount > 0 && termMonths > 0) {
        const pmt = calcAnnuity(amount, rate, termMonths);
        if (preview) preview.innerText = `Аннуитет: ${pmt.toLocaleString('ru-RU')} ₽/мес × ${termMonths} мес.`;
        if (minInput && (minInput.value === '0' || minInput.value === '')) {
            minInput.value = pmt;
        }
    } else {
        if (preview) preview.innerText = '';
    }
}

function addDebtPreset(presetKey) {
    const presets = {
        sber: { name: '💳 Сбербанк Кредитная', type: 'card', amount: 100000, limit: 150000, rate: 25.4, minPay: 3000, grace: '120 дней', dueDate: '25-е число', allowBuffer: true, strictGrace: false, graceDays: 55 },
        tinkoff: { name: '💳 Т-Банк Платинум', type: 'card', amount: 50000, limit: 100000, rate: 35.0, minPay: 2000, grace: '55 дней', dueDate: '05-е число', allowBuffer: true, strictGrace: false, graceDays: 55 },
        alfa: { name: '💳 Альфа-Банк 365 дней', type: 'card', amount: 30000, limit: 60000, rate: 30.0, minPay: 1500, grace: '100 дней', dueDate: '15-е число', allowBuffer: true, strictGrace: false, graceDays: 55 },
        consumer: { name: '🏦 Потребительский Кредит', type: 'credit', amount: 200000, limit: 0, rate: 22.0, minPay: 6500, grace: 'Нет', dueDate: '10-е число', allowBuffer: false, strictGrace: false, graceDays: 0 }
    };

    if (presets[presetKey]) {
        appData.debts.push({
            id: Date.now(),
            ...presets[presetKey]
        });
        saveData();
        recalculateApp();
    }
}

// FEAT-7: Annuity Payment Calculator — PMT = P * r / (1 - (1+r)^-n)
// Standard actuarial formula used by Russian banks for annuity schedules
function calcAnnuity(principal, annualRate, termMonths) {
    const P = Math.max(0, Number(principal) || 0);
    const n = Math.max(1, parseInt(termMonths) || 1);
    const r = (Number(annualRate) || 0) / 100 / 12;
    if (P <= 0) return 0;
    if (r <= 0) return Math.round(P / n); // Interest-free: equal principal payments
    return Math.round(P * r / (1 - Math.pow(1 + r, -n)));
}

// FEAT-7: Auto-calculate annuity button handler called from debtModal
function autoCalcAnnuity() {
    const amount = parseFloat(document.getElementById('debtAmount')?.value) || 0;
    const rate = parseFloat(document.getElementById('debtRate')?.value) || 0;
    const term = parseInt(document.getElementById('debtTermMonths')?.value) || 0;
    const preview = document.getElementById('annuityPreview');

    if (amount <= 0 || term <= 0) {
        if (preview) preview.innerText = '❗ Укажите сумму долга и срок (мес.).';
        return;
    }

    const pmt = calcAnnuity(amount, rate, term);
    const totalPay = pmt * term;
    const totalOverpay = totalPay - amount;

    // Fill the minPay field automatically
    const minPayInput = document.getElementById('debtMin');
    if (minPayInput) minPayInput.value = pmt;

    if (preview) {
        preview.innerHTML = `
            ✅ Аннуитет: <b>${pmt.toLocaleString('ru-RU')} ₽/мес</b> &times; ${term} мес.
            &nbsp;&nbsp;·&nbsp;&nbsp; Итого: <b>${totalPay.toLocaleString('ru-RU')} ₽</b>
            &nbsp;&nbsp;·&nbsp;&nbsp; Переплата: <span style="color:var(--accent-red);">${totalOverpay.toLocaleString('ru-RU')} ₽</span>
        `;
    }
}

// Calculate Debt Portfolio Metrics
function calculateDebtMetrics(debts) {
    let totalDebt = 0;
    let totalMinPay = 0;
    let totalMonthlyInterestBurn = 0;
    let weightedRateNumerator = 0;

    const now = new Date();
    const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : 2026;
    const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;

    debts.forEach(d => {
        const amt = Math.max(0, Number(d.amount) || 0);
        const rate = Math.max(0, Number(d.rate) || 0);
        const minP = Math.max(0, Number(d.minPay) || 0);

        totalDebt += amt;
        totalMinPay += minP;

        // BUG-5 FIX: Don't count monthly interest burn for cards with an active grace period
        const gDate = (typeof parseGraceDate === 'function') ? parseGraceDate(d.grace, startYear, startMonth) : null;
        const graceValid = gDate && (gDate >= new Date(now.getFullYear(), now.getMonth(), 1));
        if (!graceValid) {
            const monthlyInterest = amt * (rate / 100 / 12);
            totalMonthlyInterestBurn += monthlyInterest;
        }
        weightedRateNumerator += (amt * rate);
    });

    const weightedRate = totalDebt > 0 ? (weightedRateNumerator / totalDebt) : 0;

    // FEAT-9: Debt-to-Income Ratio (DTI)
    const totalIncome = (appData.incomes || []).filter(i => i.enabled !== false && i.frequency !== 'one_off')
        .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const dti = totalIncome > 0 ? Math.round((totalMinPay / totalIncome) * 100) : 0;

    return {
        totalDebt: Math.round(totalDebt),
        weightedRate: weightedRate.toFixed(1),
        totalMinPay: Math.round(totalMinPay),
        totalMonthlyInterestBurn: Math.round(totalMonthlyInterestBurn),
        dti
    };
}

// Savings Goals Handlers
function saveSavingsGoal(event) {
    event.preventDefault();
    const name = document.getElementById('goalName').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    const colorKey = document.getElementById('goalColor').value;

    const gradients = {
        blue: 'linear-gradient(90deg, #3b82f6, #2563eb)',
        purple: 'linear-gradient(90deg, #a855f7, #9333ea)',
        green: 'linear-gradient(90deg, #22c55e, #16a34a)',
        orange: 'linear-gradient(90deg, #f97316, #ea580c)'
    };

    if (name && !isNaN(target) && target > 0) {
        appData.savingsGoals.push({
            id: Date.now(),
            name,
            target,
            color: gradients[colorKey] || gradients.blue
        });
        saveData();
        closeModal('goalModal');
        recalculateApp();
        event.target.reset();
    }
}

function updateGoalTarget(id, newTargetVal) {
    const goal = appData.savingsGoals.find(g => g.id === id);
    if (goal) {
        const num = parseFloat(newTargetVal);
        if (!isNaN(num) && num > 0) {
            goal.target = num;
            saveData();
            recalculateApp();
        }
    }
}

function deleteSavingsGoal(id) {
    if (confirm('Удалить эту цель накопления?')) {
        appData.savingsGoals = appData.savingsGoals.filter(g => g.id !== id);
        saveData();
        recalculateApp();
    }
}

// JSON Import / Export
function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `Finance_OS_Backup_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
}

function importJSON(event) {
    const fileReader = new FileReader();
    fileReader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && typeof importedData === 'object') {
                appData = {
                    cash: typeof importedData.cash === 'number' ? importedData.cash : DEFAULT_DATA.cash,
                    strategy: importedData.strategy || DEFAULT_DATA.strategy,
                    // BUG-6 FIX: Restore startDate and excludedItems from backup
                    startDate: importedData.startDate || DEFAULT_DATA.startDate,
                    incomes: Array.isArray(importedData.incomes) ? importedData.incomes : [],
                    expenses: Array.isArray(importedData.expenses) ? importedData.expenses : [],
                    debts: Array.isArray(importedData.debts) ? importedData.debts : [],
                    savingsGoals: Array.isArray(importedData.savingsGoals) ? importedData.savingsGoals : DEFAULT_DATA.savingsGoals,
                    executedItems: importedData.executedItems || {},
                    excludedItems: importedData.excludedItems || {},
                    customAmounts: importedData.customAmounts || {}
                };
                saveData();
                recalculateApp();
                alert('Данные успешно импортированы!');
            } else {
                alert('Ошибка: неверный формат файла JSON.');
            }
        } catch (err) {
            alert('Ошибка при чтении файла JSON.');
        }
    };
    if (event.target.files[0]) {
        fileReader.readAsText(event.target.files[0]);
    }
}

// Payment Execution Tracker & Executive Print Helpers
function toggleExecutedItem(itemKey) {
    if (!appData.executedItems) appData.executedItems = {};
    appData.executedItems[itemKey] = !appData.executedItems[itemKey];
    saveData();
    recalculateApp();
}

function isItemExecuted(itemKey) {
    return !!(appData.executedItems && appData.executedItems[itemKey]);
}

function toggleExcludedItem(itemKey) {
    if (!appData.excludedItems) appData.excludedItems = {};
    appData.excludedItems[itemKey] = !appData.excludedItems[itemKey];
    saveData();
    recalculateApp();
}

function isItemExcluded(itemKey) {
    return !!(appData.excludedItems && appData.excludedItems[itemKey]);
}

// Custom Event Amount Overrides (Per-Month Realistic Amount Feature)
function setCustomItemAmount(itemKey, val) {
    if (!appData.customAmounts) appData.customAmounts = {};
    if (val === null || val === undefined || val === '') {
        delete appData.customAmounts[itemKey];
    } else {
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0) {
            appData.customAmounts[itemKey] = num;
        } else {
            delete appData.customAmounts[itemKey];
        }
    }
    saveData();
    recalculateApp();
}

function getCustomItemAmount(itemKey) {
    if (appData.customAmounts && appData.customAmounts[itemKey] !== undefined) {
        return appData.customAmounts[itemKey];
    }
    return null;
}

function resetCustomItemAmount(itemKey) {
    if (appData.customAmounts && appData.customAmounts[itemKey] !== undefined) {
        delete appData.customAmounts[itemKey];
        saveData();
        recalculateApp();
    }
}

function printReport() {
    window.print();
}


