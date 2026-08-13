/**
 * Finance OS - High-Performance UI Rendering & Chart.js Integration
 * Includes Dynamic Debt Fields by Type & Emergency Fund Runway Meter
 */

let debtChartInstance = null;
let structChartInstance = null;
let expenseCategoriesChartInstance = null;
let currentChartViewMode = 'breakdown'; // 'breakdown' | 'comparison' | 'interest'
let scheduleFilterMode = 'all'; // 'all' | 'debts' | 'savings'
let calendarFilterMode = 'all'; // 'all' | 'debts' | 'milestones' | 'incomes'
let scheduleViewType = 'cards'; // 'cards' | 'table'
let donutViewMode = 'categories'; // 'categories' | 'ratio'

var EXPENSE_CATEGORY_COLORS = {
    housing: '#3b82f6',   // 🏠 Жилье и ЖКХ
    food: '#f59e0b',      // 🛒 Продукты и Еда
    transport: '#a855f7', // 🚗 Транспорт и Авто
    services: '#06b6d4',  // 📱 Связь и Подписки
    health: '#ef4444',    // 💊 Здоровье и Аптека
    life: '#ec4899',      // 👕 Быт и Покупки
    hobby: '#10b981',     // 🎈 Развлечения
    other: '#64748b'      // 📦 Прочее
};

function setDonutViewMode(mode) {
    donutViewMode = mode;
    const catContainer = document.getElementById('donutCategoriesContainer');
    const ratioContainer = document.getElementById('donutRatioContainer');
    if (catContainer && ratioContainer) {
        if (mode === 'categories') {
            catContainer.style.display = 'block';
            ratioContainer.style.display = 'none';
        } else {
            catContainer.style.display = 'none';
            ratioContainer.style.display = 'block';
        }
    }
    document.querySelectorAll('.donut-toggle-btn').forEach(btn => {
        if (btn.dataset.donut === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

var CATEGORY_NAMES = {
    salary: '💼 Оклад',
    bonus: '🎁 Премия',
    freelance: '💻 Фриланс',
    passive: '📈 Пассивный',
    other: '💵 Прочее'
};

var DEBT_COLORS = [
    { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },  // Red
    { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },  // Blue
    { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' }, // Purple
    { border: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' }, // Orange
    { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' }   // Green
];

var GOAL_LINE_COLORS = ['#22c55e', '#a855f7', '#06b6d4', '#eab308', '#ec4899'];

function setChartViewMode(mode) {
    currentChartViewMode = mode;
    recalculateApp();
}

function setScheduleFilter(filter) {
    scheduleFilterMode = filter;
    recalculateApp();
}

function setScheduleViewType(type) {
    scheduleViewType = type;
    document.querySelectorAll('.schedule-type-view-btn').forEach(btn => {
        if (btn.dataset.view === type) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const cardsBox = document.getElementById('scheduleCardsContainer');
    const tableBox = document.getElementById('scheduleTableContainer');

    if (cardsBox) cardsBox.style.display = type === 'cards' ? 'block' : 'none';
    if (tableBox) tableBox.style.display = type === 'table' ? 'block' : 'none';
}

function setCalendarFilter(filter) {
    calendarFilterMode = filter;
    recalculateApp();
}

// Collapsible Month Accordion Handlers
function toggleMonthAccordion(cardId) {
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.toggle('collapsed');
    }
}

function expandAllMonthCards() {
    document.querySelectorAll('.month-detail-card').forEach(card => {
        card.classList.remove('collapsed');
    });
}

function collapseAllMonthCards() {
    document.querySelectorAll('.month-detail-card').forEach(card => {
        card.classList.add('collapsed');
    });
}

function expandCurrentMonthCard() {
    document.querySelectorAll('.month-detail-card').forEach((card, idx) => {
        if (idx === 0) card.classList.remove('collapsed');
        else card.classList.add('collapsed');
    });
}

function recalculateApp() {
    try {
        // Update Start Date Button in Header
        const startDateBtnText = document.getElementById('startDateHeaderBtnText');
        if (startDateBtnText && appData.startDate) {
            const d = String(appData.startDate.day || 1).padStart(2, '0');
            const m = String((appData.startDate.monthIdx !== undefined ? appData.startDate.monthIdx : 7) + 1).padStart(2, '0');
            const y = appData.startDate.year || 2026;
            startDateBtnText.innerText = `${d}.${m}.${y}`;
        }

        // FEAT-3: Show nearest payment notification (today/tomorrow)
        showNearestPaymentNotification();

        const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : 2026;
        const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;
        const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const currentMonthLabel = `${MONTH_NAMES[startMonth]} ${startYear}`;

        const regularIncomes = (appData.incomes || []).filter(i => i.enabled !== false && i.frequency !== 'one_off');
        const oneOffIncomesCurMonth = (appData.incomes || []).filter(i => i.enabled !== false && i.frequency === 'one_off' && i.oneOffMonth === currentMonthLabel);
        
        const regularExpenses = (appData.expenses || []).filter(e => e.enabled !== false && e.frequency !== 'one_off');
        const oneOffExpensesCurMonth = (appData.expenses || []).filter(e => e.enabled !== false && e.frequency === 'one_off' && e.oneOffMonth === currentMonthLabel);

        const baseIncome = regularIncomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        const oneOffIncomeAmt = oneOffIncomesCurMonth.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        const totalIncome = baseIncome + oneOffIncomeAmt;

        const baseExpense = regularExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const oneOffExpenseAmt = oneOffExpensesCurMonth.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalExpense = baseExpense + oneOffExpenseAmt;

        const fcf = totalIncome - totalExpense;
        const totalDebt = (appData.debts || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

        // Update KPI Elements
        const kpiCash = document.getElementById('kpiCash');
        if (kpiCash) kpiCash.innerText = (Number(appData.cash) || 0).toLocaleString('ru-RU') + ' ₽';
        
        const kpiIncome = document.getElementById('kpiIncome');
        if (kpiIncome) kpiIncome.innerText = totalIncome.toLocaleString('ru-RU') + ' ₽';
        
        const incNames = regularIncomes.map(i => i.name).slice(0, 3).join(', ');
        const incSubElem = document.getElementById('kpiIncomeSub');
        if (incSubElem) {
            let subText = regularIncomes.length > 0 ? incNames + (regularIncomes.length > 3 ? '...' : '') : 'Нет активных доходов';
            if (oneOffIncomeAmt > 0) subText += ` (+${oneOffIncomeAmt.toLocaleString('ru-RU')} ₽ разово)`;
            incSubElem.innerText = subText;
        }

        const kpiExpense = document.getElementById('kpiExpense');
        if (kpiExpense) kpiExpense.innerText = totalExpense.toLocaleString('ru-RU') + ' ₽';
        
        const fcfElem = document.getElementById('kpiFCF');
        if (fcfElem) {
            fcfElem.innerText = fcf.toLocaleString('ru-RU') + ' ₽';
            if (fcf < 0) {
                fcfElem.className = 'kpi-value val-red';
                const alertElem = document.getElementById('deficitAlert');
                if (alertElem) alertElem.style.display = 'flex';
            } else {
                fcfElem.className = 'kpi-value val-green';
                const alertElem = document.getElementById('deficitAlert');
                if (alertElem) alertElem.style.display = 'none';
            }
        }
        
        const kpiDebt = document.getElementById('kpiDebt');
        if (kpiDebt) kpiDebt.innerText = Math.round(totalDebt).toLocaleString('ru-RU') + ' ₽';

    // Emergency Fund Coverage & Financial Runway Meter (based on regular base expense)
    const effExpense = baseExpense > 0 ? baseExpense : totalExpense;
    const runwayMonths = effExpense > 0 ? (appData.cash / effExpense).toFixed(1) : '∞';
    const runwayElem = document.getElementById('kpiRunway');
    const runwaySubElem = document.getElementById('kpiRunwaySub');

    if (runwayElem && runwaySubElem) {
        runwayElem.innerText = `${runwayMonths} мес.`;
        if (runwayMonths === '∞' || parseFloat(runwayMonths) >= 3.0) {
            runwayElem.className = 'kpi-value val-green';
            runwaySubElem.innerText = '🛡️ Надежный подушечный щит';
        } else if (parseFloat(runwayMonths) >= 1.0) {
            runwayElem.className = 'kpi-value val-orange';
            runwaySubElem.innerText = '🟡 Базовый запас наличных';
        } else {
            runwayElem.className = 'kpi-value val-red';
            runwaySubElem.innerText = '⚠️ Низкий запас (риск дефицита)';
        }
    }

    // Buttons UI Active States
    document.querySelectorAll('.strategy-btn').forEach(btn => {
        if (btn.dataset.strategy === appData.strategy) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.chart-mode-btn').forEach(btn => {
        if (btn.dataset.mode === currentChartViewMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.schedule-filter-btn').forEach(btn => {
        if (btn.dataset.filter === scheduleFilterMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.calendar-filter-btn').forEach(btn => {
        if (btn.dataset.filter === calendarFilterMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // FEAT-C: Sync horizon buttons active state
    document.querySelectorAll('.horizon-btn').forEach(btn => {
        if (parseInt(btn.dataset.horizon) === (appData.horizonMonths || 24)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Render Data Tables & Summaries
    renderIncomeSummary();
    renderExpenseSummary();
    renderDebtPortfolioMetricsBar();
    renderTables();

    // Run Financial Simulation Engine (configurable horizon)
    const simResult = runFinancialSimulation(appData.debts, fcf, appData.cash, appData.strategy, appData.horizonMonths || 24);
    
    // Render Analytics Banner
    renderAnalyticsBanner(simResult);

    // Render What-If Scenarios
    renderWhatIf(fcf, appData.cash, appData.debts);

    // Render Dashboard Widgets & Dedicated Schedule Tab
    renderSimulationUI(simResult);
    renderDetailedScheduleTab(simResult);

    // Render Dynamic Calendar (Chronological Roadmap through Debt Freedom & Goals)
    renderDynamicCalendar(simResult);

    // Render Charts
    renderCharts(totalIncome, totalExpense, simResult);
    } catch (err) {
        console.error('Error during recalculateApp:', err);
    }
}

function renderAnalyticsBanner(sim) {
    const analyticsElem = document.getElementById('chartAnalyticsBar');
    if (!analyticsElem) return;

    const savedMoney = sim.analytics.interestSaved;
    const paidInterest = sim.analytics.interestPaid;

    analyticsElem.innerHTML = `
        <div class="metric-chip metric-chip-highlight">
            <span style="font-size:16px;">🔥</span>
            <div>
                <div style="font-weight:700; color:var(--accent-green);">Сэкономлено ${savedMoney.toLocaleString('ru-RU')} ₽</div>
                <div style="font-size:11px; color:var(--text-secondary);">благодаря досрочному погашению</div>
            </div>
        </div>
        <div class="metric-chip">
            <span style="font-size:16px;">⚡</span>
            <div>
                <div style="font-weight:700; color:var(--accent-blue);">Свобода за ${sim.monthsCount} мес.</div>
                <div style="font-size:11px; color:var(--text-secondary);">${sim.freedomMonth}</div>
            </div>
        </div>
        <div class="metric-chip">
            <span style="font-size:16px;">💸</span>
            <div>
                <div style="font-weight:700; color:var(--accent-orange);">Переплата %: ${paidInterest.toLocaleString('ru-RU')} ₽</div>
                <div style="font-size:11px; color:var(--text-secondary);">проценты за весь период</div>
            </div>
        </div>
    `;
}

// FEAT-D: Inline field validation
function validateNumberInput(el, min = 0, max = 99999999) {
    const val = parseFloat(el.value);
    const isValid = !isNaN(val) && val >= min && val <= max;
    el.classList.toggle('input-error', !isValid);
    el.title = isValid ? '' : `Введите число от ${min} до ${max.toLocaleString('ru-RU')}`;
    return isValid;
}

function renderDebtPortfolioMetricsBar() {
    const metricsContainer = document.getElementById('debtPortfolioMetricsBar');
    if (!metricsContainer) return;

    const metrics = calculateDebtMetrics(appData.debts);

    // FEAT-9: DTI color coding — green <30%, orange 30-50%, red >50%
    const dtiColor = metrics.dti < 30 ? 'val-green' : (metrics.dti < 50 ? 'val-orange' : 'val-red');
    const dtiLabel = metrics.dti < 30 ? '✅ Норма' : (metrics.dti < 50 ? '⚠️ Повышенный' : '🚨 Опасно!');

    metricsContainer.innerHTML = `
        <div class="debt-metric-card">
            <div class="debt-metric-title">Совокупный долг</div>
            <div class="debt-metric-val val-red">${metrics.totalDebt.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div class="debt-metric-card">
            <div class="debt-metric-title">Средняя ставка %</div>
            <div class="debt-metric-val val-orange">${metrics.weightedRate}% годовых</div>
        </div>
        <div class="debt-metric-card">
            <div class="debt-metric-title">Мин. платежи в месяц</div>
            <div class="debt-metric-val val-blue">${metrics.totalMinPay.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div class="debt-metric-card" style="background: rgba(239, 68, 68, 0.08); border-color: var(--accent-red);">
            <div class="debt-metric-title" style="color:var(--accent-red);">💸 Потери на % в месяц</div>
            <div class="debt-metric-val val-red">~${metrics.totalMonthlyInterestBurn.toLocaleString('ru-RU')} ₽/мес</div>
        </div>
        <div class="debt-metric-card" style="background: ${metrics.dti >= 50 ? 'rgba(239, 68, 68, 0.08)' : metrics.dti >= 30 ? 'rgba(249, 115, 22, 0.08)' : 'rgba(34, 197, 94, 0.08)'}; border-color: ${metrics.dti >= 50 ? 'var(--accent-red)' : metrics.dti >= 30 ? 'var(--accent-orange)' : 'var(--accent-green)'}">
            <div class="debt-metric-title" title="Debt-to-Income: доля мин. платежей от дохода. Норма: не более 30%">📊 DTI (Кредитная нагрузка)</div>
            <div class="debt-metric-val ${dtiColor}">${metrics.dti}% <span style="font-size:10px; font-weight:500;">${dtiLabel}</span></div>
        </div>
    `;

    // FEAT-F: Per-debt interest breakdown
    const startYear2 = (appData.startDate && appData.startDate.year) ? appData.startDate.year : 2026;
    const startMonth2 = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;
    const activeDebtsWithInterest = appData.debts.filter(d => {
        if ((d.amount || 0) <= 0 || (d.rate || 0) <= 0) return false;
        const gDate = (typeof parseGraceDate === 'function') ? parseGraceDate(d.grace, startYear2, startMonth2) : null;
        const graceValid = gDate && (gDate >= new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        return !graceValid;
    });

    if (activeDebtsWithInterest.length > 0) {
        const breakdownRows = activeDebtsWithInterest.map(d => {
            const monthlyBurn = Math.round(d.amount * (d.rate / 100 / 12));
            const share = metrics.totalMonthlyInterestBurn > 0 ? Math.round((monthlyBurn / metrics.totalMonthlyInterestBurn) * 100) : 0;
            const barWidth = Math.max(4, share);
            return `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <div style="font-size:11px; color:var(--text-secondary); min-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</div>
                    <div style="flex:1; height:6px; background:var(--bg-tertiary); border-radius:3px; overflow:hidden;">
                        <div style="width:${barWidth}%; height:100%; background:var(--accent-red); border-radius:3px;"></div>
                    </div>
                    <div style="font-size:11px; font-weight:700; color:var(--accent-red); white-space:nowrap;">~${monthlyBurn.toLocaleString('ru-RU')} ₽/мес</div>
                    <div style="font-size:10px; color:var(--text-secondary); min-width:30px;">${share}%</div>
                </div>`;
        }).join('');
        metricsContainer.innerHTML += `
            <div class="debt-metric-card" style="grid-column: 1 / -1; background:rgba(239,68,68,0.05); border-color:rgba(239,68,68,0.2);">
                <div class="debt-metric-title" style="color:var(--accent-red); margin-bottom:10px;">📊 Разбивка процентных потерь по долгам</div>
                ${breakdownRows}
            </div>`;
    }
}


function renderIncomeSummary() {
    const summaryContainer = document.getElementById('incomeStatsSummary');
    if (!summaryContainer) return;

    const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : 2026;
    const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;
    const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const currentMonthLabel = `${MONTH_NAMES[startMonth]} ${startYear}`;

    let baseTotal = 0;
    let oneOffTotalCurrentMonth = 0;
    const totalsByCategory = { salary: 0, bonus: 0, freelance: 0, passive: 0, other: 0 };

    appData.incomes.forEach(i => {
        if (i.enabled !== false) {
            const amt = Number(i.amount) || 0;
            if (i.frequency === 'one_off') {
                if (i.oneOffMonth === currentMonthLabel) {
                    oneOffTotalCurrentMonth += amt;
                }
            } else {
                baseTotal += amt;
                const cat = i.category || 'other';
                totalsByCategory[cat] = (totalsByCategory[cat] || 0) + amt;
            }
        }
    });

    let html = `<div class="stat-pill"><span style="font-weight:700;">Базовый доход (ежемесячно):</span> <span class="val-green" style="font-weight:700;">${baseTotal.toLocaleString('ru-RU')} ₽</span></div>`;
    if (oneOffTotalCurrentMonth > 0) {
        html += `<div class="stat-pill"><span style="font-weight:700;">⚡ Разовые в ${currentMonthLabel}:</span> <span class="val-purple" style="font-weight:700;">+${oneOffTotalCurrentMonth.toLocaleString('ru-RU')} ₽</span></div>`;
        html += `<div class="stat-pill"><span style="font-weight:700;">Итого за ${currentMonthLabel}:</span> <span class="val-green" style="font-weight:700;">${(baseTotal + oneOffTotalCurrentMonth).toLocaleString('ru-RU')} ₽</span></div>`;
    }

    Object.keys(CATEGORY_NAMES).forEach(cat => {
        if (totalsByCategory[cat] > 0) {
            const share = Math.round((totalsByCategory[cat] / (baseTotal || 1)) * 100) || 0;
            html += `<div class="stat-pill"><span>${CATEGORY_NAMES[cat]}:</span> <b>${totalsByCategory[cat].toLocaleString('ru-RU')} ₽</b> <span style="color:var(--text-secondary); font-size:11px;">(${share}%)</span></div>`;
        }
    });

    summaryContainer.innerHTML = html;
}

function renderExpenseSummary() {
    const summaryContainer = document.getElementById('expenseStatsSummary');
    if (!summaryContainer) return;

    const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : 2026;
    const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;
    const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const currentMonthLabel = `${MONTH_NAMES[startMonth]} ${startYear}`;

    let baseTotal = 0;
    let oneOffTotalCurrentMonth = 0;
    const totalsByCategory = {};

    appData.expenses.forEach(e => {
        if (e.enabled !== false) {
            const amt = Number(e.amount) || 0;
            if (e.frequency === 'one_off') {
                if (e.oneOffMonth === currentMonthLabel) {
                    oneOffTotalCurrentMonth += amt;
                }
            } else {
                baseTotal += amt;
                const cat = e.category || 'other';
                totalsByCategory[cat] = (totalsByCategory[cat] || 0) + amt;
            }
        }
    });

    let html = `<div class="stat-pill"><span style="font-weight:700;">Базовые расходы (ежемесячно):</span> <span class="val-red" style="font-weight:700;">${baseTotal.toLocaleString('ru-RU')} ₽</span></div>`;
    if (oneOffTotalCurrentMonth > 0) {
        html += `<div class="stat-pill"><span style="font-weight:700;">⚡ Разовые в ${currentMonthLabel}:</span> <span class="val-purple" style="font-weight:700;">+${oneOffTotalCurrentMonth.toLocaleString('ru-RU')} ₽</span></div>`;
        html += `<div class="stat-pill"><span style="font-weight:700;">Итого за ${currentMonthLabel}:</span> <span class="val-red" style="font-weight:700;">${(baseTotal + oneOffTotalCurrentMonth).toLocaleString('ru-RU')} ₽</span></div>`;
    }

    Object.keys(EXPENSE_CATEGORY_NAMES).forEach(catKey => {
        if (totalsByCategory[catKey] > 0) {
            const share = Math.round((totalsByCategory[catKey] / (baseTotal || 1)) * 100) || 0;
            html += `<div class="stat-pill"><span>${EXPENSE_CATEGORY_NAMES[catKey]}:</span> <b>${totalsByCategory[catKey].toLocaleString('ru-RU')} ₽</b> <span style="color:var(--text-secondary); font-size:11px;">(${share}%)</span></div>`;
        }
    });

    summaryContainer.innerHTML = html;
}

function renderIncomeRow(i) {
    const isEnabled = i.enabled !== false;
    const rowClass = isEnabled ? '' : 'row-disabled';
    const isOneOff = i.frequency === 'one_off';
    
    let categoryOptions = Object.keys(CATEGORY_NAMES).map(catKey => {
        return `<option value="${catKey}" ${i.category === catKey ? 'selected' : ''}>${CATEGORY_NAMES[catKey]}</option>`;
    }).join('');

    let scheduleBadge = '';
    if (i.scheduleType === 'split') {
        const advK = i.advanceAmount >= 1000 ? (i.advanceAmount / 1000).toFixed(1) + 'k' : i.advanceAmount;
        const mainK = i.mainAmount >= 1000 ? (i.mainAmount / 1000).toFixed(1) + 'k' : i.mainAmount;
        scheduleBadge = `<span class="badge badge-blue" style="font-size:10px;">${escapeHtml(i.advanceDay || 'Аванс')}: ${advK} ₽</span> <span class="badge badge-green" style="font-size:10px;">${escapeHtml(i.mainDay || 'Расчет')}: ${mainK} ₽</span>`;
    } else {
        scheduleBadge = `<span class="badge badge-blue" style="font-size:10px;">${escapeHtml(i.day || 'В течение месяца')}</span>`;
    }

    let frequencyBadge = isOneOff 
        ? `<span class="badge badge-purple" style="font-size:10px;">⚡ Разово (${escapeHtml(i.oneOffMonth || 'Месяц')})</span>` 
        : `<span class="badge badge-green" style="font-size:10px;">🔄 Ежемесячно</span>`;

    return `
        <tr class="${rowClass}">
            <td style="text-align: center;">
                <label class="toggle-switch" title="${isEnabled ? 'Отключить источник' : 'Включить источник'}">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleIncome(${i.id})">
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <input type="text" class="editable-input editable-input-text" value="${escapeHtml(i.name)}" onchange="updateIncomeField(${i.id}, 'name', this.value)">
                <div style="margin-top:4px;">${frequencyBadge}</div>
            </td>
            <td>
                <select onchange="updateIncomeField(${i.id}, 'category', this.value)">
                    ${categoryOptions}
                </select>
            </td>
            <td>
                <div class="currency-input-box">
                    <input type="number" class="val-green" value="${i.amount}" oninput="validateNumberInput(this)" onchange="updateIncomeField(${i.id}, 'amount', this.value)">
                    <span class="currency-label val-green">₽</span>
                </div>
            </td>
            <td>
                ${scheduleBadge}
            </td>
            <td style="text-align: center;">
                <div class="action-btns-group">
                    <button class="btn btn-primary action-btn-icon" onclick="openIncomeModal(${i.id})" title="Редактировать">✏️</button>
                    <button class="btn btn-secondary action-btn-icon" onclick="duplicateIncome(${i.id})" title="Дублировать">📋</button>
                    <button class="btn btn-secondary action-btn-icon" onclick="deleteIncome(${i.id})" title="Удалить">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

function renderExpenseRow(e) {
    const isEnabled = e.enabled !== false;
    const rowClass = isEnabled ? '' : 'row-disabled';
    const isOneOff = e.frequency === 'one_off';

    let categoryOptions = Object.keys(EXPENSE_CATEGORY_NAMES).map(catKey => {
        return `<option value="${catKey}" ${e.category === catKey ? 'selected' : ''}>${EXPENSE_CATEGORY_NAMES[catKey]}</option>`;
    }).join('');

    let frequencyBadge = isOneOff 
        ? `<span class="badge badge-purple" style="font-size:10px;">⚡ Разово (${escapeHtml(e.oneOffMonth || 'Месяц')})</span>` 
        : `<span class="badge badge-red" style="font-size:10px;">🔄 Ежемесячно</span>`;

    return `
        <tr class="${rowClass}">
            <td style="text-align: center;">
                <label class="toggle-switch" title="${isEnabled ? 'Отключить расход' : 'Включить расход'}">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleExpense(${e.id})">
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <input type="text" class="editable-input editable-input-text" value="${escapeHtml(e.name)}" onchange="updateExpenseField(${e.id}, 'name', this.value)">
                <div style="margin-top:4px;">${frequencyBadge}</div>
            </td>
            <td>
                <select onchange="updateExpenseField(${e.id}, 'category', this.value)">
                    ${categoryOptions}
                </select>
            </td>
            <td>
                <div class="currency-input-box">
                    <input type="number" class="val-red" value="${e.amount}" oninput="validateNumberInput(this)" onchange="updateExpenseField(${e.id}, 'amount', this.value)">
                    <span class="currency-label val-red">₽</span>
                </div>
            </td>
            <td>
                <input type="text" class="editable-input editable-input-text" style="font-size:11px;" value="${escapeHtml(e.day || 'В течение месяца')}" onchange="updateExpenseField(${e.id}, 'day', this.value)">
            </td>
            <td style="text-align: center;">
                <div class="action-btns-group">
                    <button class="btn btn-primary action-btn-icon" onclick="openExpenseModal(${e.id})" title="Редактировать">✏️</button>
                    <button class="btn btn-secondary action-btn-icon" onclick="duplicateExpense(${e.id})" title="Дублировать">📋</button>
                    <button class="btn btn-secondary action-btn-icon" onclick="deleteExpense(${e.id})" title="Удалить">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

function parseMonthLabelToSortValue(monthLabel) {
    if (!monthLabel) return 0;
    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const parts = monthLabel.trim().split(' ');
    if (parts.length >= 2) {
        const mIdx = monthsRu.indexOf(parts[0]);
        const year = parseInt(parts[1], 10);
        if (mIdx !== -1 && !isNaN(year)) {
            return year * 12 + mIdx;
        }
    }
    return 0;
}

function renderTables() {
    // Income Table
    const incBody = document.getElementById('incomeTableBody');
    if (incBody) {
        incBody.innerHTML = '';
        
        const regularInc = appData.incomes.filter(i => i.frequency !== 'one_off');
        const oneOffInc = appData.incomes.filter(i => i.frequency === 'one_off');

        if (regularInc.length > 0 && oneOffInc.length > 0) {
            const regSum = regularInc.reduce((sum, i) => sum + (i.enabled !== false ? (Number(i.amount)||0) : 0), 0);
            incBody.innerHTML += `
                <tr class="table-section-divider">
                    <td colspan="6">🔄 Ежемесячные базовые доходы (${regSum.toLocaleString('ru-RU')} ₽/мес)</td>
                </tr>
            `;
        }

        regularInc.forEach(i => {
            incBody.innerHTML += renderIncomeRow(i);
        });

        if (oneOffInc.length > 0) {
            const oneOffsByMonth = {};
            oneOffInc.forEach(i => {
                const m = i.oneOffMonth || 'Разовые доходы';
                if (!oneOffsByMonth[m]) oneOffsByMonth[m] = [];
                oneOffsByMonth[m].push(i);
            });

            const sortedIncomeMonthKeys = Object.keys(oneOffsByMonth).sort((a, b) => {
                return parseMonthLabelToSortValue(a) - parseMonthLabelToSortValue(b);
            });

            sortedIncomeMonthKeys.forEach(monthLabel => {
                const mItems = oneOffsByMonth[monthLabel];
                const mSum = mItems.reduce((sum, i) => sum + (i.enabled !== false ? (Number(i.amount)||0) : 0), 0);
                incBody.innerHTML += `
                    <tr class="table-section-divider table-section-divider-purple">
                        <td colspan="6">⚡ Разовые доходы за ${escapeHtml(monthLabel)} (+${mSum.toLocaleString('ru-RU')} ₽)</td>
                    </tr>
                `;
                mItems.forEach(i => {
                    incBody.innerHTML += renderIncomeRow(i);
                });
            });
        }
    }

    // Expense Table
    const expBody = document.getElementById('expenseTableBody');
    if (expBody) {
        expBody.innerHTML = '';
        
        const regularExp = appData.expenses.filter(e => e.frequency !== 'one_off');
        const oneOffExp = appData.expenses.filter(e => e.frequency === 'one_off');

        if (regularExp.length > 0 && oneOffExp.length > 0) {
            const regSum = regularExp.reduce((sum, e) => sum + (e.enabled !== false ? (Number(e.amount)||0) : 0), 0);
            expBody.innerHTML += `
                <tr class="table-section-divider">
                    <td colspan="6">🔄 Ежемесячные базовые расходы (${regSum.toLocaleString('ru-RU')} ₽/мес)</td>
                </tr>
            `;
        }

        regularExp.forEach(e => {
            expBody.innerHTML += renderExpenseRow(e);
        });

        if (oneOffExp.length > 0) {
            const oneOffsByMonth = {};
            oneOffExp.forEach(e => {
                const m = e.oneOffMonth || 'Разовые расходы';
                if (!oneOffsByMonth[m]) oneOffsByMonth[m] = [];
                oneOffsByMonth[m].push(e);
            });

            const sortedExpenseMonthKeys = Object.keys(oneOffsByMonth).sort((a, b) => {
                return parseMonthLabelToSortValue(a) - parseMonthLabelToSortValue(b);
            });

            sortedExpenseMonthKeys.forEach(monthLabel => {
                const mItems = oneOffsByMonth[monthLabel];
                const mSum = mItems.reduce((sum, e) => sum + (e.enabled !== false ? (Number(e.amount)||0) : 0), 0);
                expBody.innerHTML += `
                    <tr class="table-section-divider table-section-divider-purple">
                        <td colspan="6">⚡ Разовые расходы за ${escapeHtml(monthLabel)} (+${mSum.toLocaleString('ru-RU')} ₽)</td>
                    </tr>
                `;
                mItems.forEach(e => {
                    expBody.innerHTML += renderExpenseRow(e);
                });
            });
        }
    }

    // Pro Debt Portfolio Table with Type-Aware Cell Rendering
    const debtBody = document.getElementById('debtsTableBody');
    if (debtBody) {
        debtBody.innerHTML = '';

        let sortedDebts = [...appData.debts];
        if (appData.strategy === 'snowball') {
            sortedDebts.sort((a, b) => a.amount - b.amount);
        } else {
            sortedDebts.sort((a, b) => b.rate - a.rate);
        }

        sortedDebts.forEach((d, idx) => {
            const isTopPriority = idx === 0 && d.amount > 0;
            const rowClass = isTopPriority ? 'row-focus-target' : '';
            const priorityText = isTopPriority ? '🔥 #1 Главная цель' : '#' + (idx + 1) + ' Обслуживание';
            
            const monthlyInterestBurn = Math.round(d.amount * (d.rate / 100 / 12));
            const isCard = !d.type || d.type === 'card';
            const limitUtilPercent = (isCard && d.limit > 0) ? Math.min(100, Math.round((d.amount / d.limit) * 100)) : null;

            let debtTypeOptions = Object.keys(DEBT_TYPE_NAMES).map(typeKey => {
                return `<option value="${typeKey}" ${d.type === typeKey ? 'selected' : ''}>${DEBT_TYPE_NAMES[typeKey]}</option>`;
            }).join('');

            // Limit Cell HTML
            let limitCellHtml = '—';
            if (isCard) {
                limitCellHtml = `
                    <input type="number" class="editable-input" style="width:90px;" value="${d.limit || 0}" onchange="updateDebtField(${d.id}, 'limit', this.value)"> ₽
                    ${limitUtilPercent !== null ? `<br><span class="badge ${limitUtilPercent > 70 ? 'badge-red' : 'badge-blue'}" style="font-size:9px;">${limitUtilPercent}% занято</span>` : ''}
                `;
            } else {
                limitCellHtml = `<span style="font-size:11px; color:var(--text-secondary);">— (Кредит)</span>`;
            }

            // Grace Cell HTML
            let graceCellHtml = '';
            if (isCard) {
                const bufferBadge = (d.allowBuffer !== false)
                    ? `<span class="badge badge-blue" style="font-size:9px; cursor:pointer;" onclick="toggleDebtBuffer(${d.id})" title="Буфер включён — нажмите, чтобы отключить использование карты при кассовом разрыве">🛡️ Буфер</span>`
                    : `<span class="badge badge-secondary" style="font-size:9px; opacity:0.6; cursor:pointer;" onclick="toggleDebtBuffer(${d.id})" title="Буфер отключён — нажмите, чтобы разрешить использовать карту при кассовом разрыве">🚫 Буфер выкл</span>`;
                const strictBadge = d.strictGrace
                    ? `<span class="badge badge-red" style="font-size:9px; margin-left:2px; cursor:pointer;" onclick="toggleDebtStrictGrace(${d.id})" title="Строгий грейс включён — нажмите, чтобы отключить">🔥 Строгий</span>`
                    : `<span class="badge badge-secondary" style="font-size:9px; margin-left:2px; opacity:0.5; cursor:pointer;" onclick="toggleDebtStrictGrace(${d.id})" title="Нажмите, чтобы включить строгий режим грейса">🔥 Обычный</span>`;
                graceCellHtml = `
                    <div style="margin-bottom:4px;">Грейс: <input type="text" class="editable-input" style="width:80px; font-size:11px; padding:2px 4px;" value="${escapeHtml(d.grace || 'Нет')}" onchange="updateDebtField(${d.id}, 'grace', this.value)"></div>
                    <div style="display:flex; gap:3px; flex-wrap:wrap;">${bufferBadge}${strictBadge}</div>`;
            } else {
                graceCellHtml = `<div style="margin-bottom:2px; font-size:11px; color:var(--text-secondary);">Грейс: —</div>`;
            }

            const startMonthBadge = d.startMonth
                ? `<div style="margin-top:2px;"><span class="badge badge-purple" style="font-size:9px;" title="Выплаты по кредиту начнутся с ${escapeHtml(d.startMonth)}">⏳ С ${escapeHtml(d.startMonth)}</span></div>`
                : '';

            debtBody.innerHTML += `
                <tr class="${rowClass}">
                    <td>
                        <input type="text" class="editable-input editable-input-text" style="font-weight:700; width:130px; margin-bottom:4px;" value="${escapeHtml(d.name)}" onchange="updateDebtField(${d.id}, 'name', this.value)">
                        <div>
                            <select style="font-size:10px; padding:2px 4px; width:130px;" onchange="updateDebtField(${d.id}, 'type', this.value)">
                                ${debtTypeOptions}
                            </select>
                            ${startMonthBadge}
                        </div>
                    </td>
                    <td>
                        <input type="number" step="0.01" class="editable-input val-red" value="${d.amount}" onchange="updateDebtField(${d.id}, 'amount', this.value)"> ₽
                    </td>
                    <td>
                        ${limitCellHtml}
                    </td>
                    <td>
                        <input type="number" step="0.01" class="editable-input val-orange" style="width:70px;" value="${d.rate}" onchange="updateDebtField(${d.id}, 'rate', this.value)"> %
                        <br><span style="font-size:10px; color:var(--accent-red); font-weight:600;">💸 ~${monthlyInterestBurn.toLocaleString('ru-RU')} ₽/мес %</span>
                    </td>
                    <td>
                        <input type="number" class="editable-input" style="width:85px;" value="${d.minPay || 0}" onchange="updateDebtField(${d.id}, 'minPay', this.value)"> ₽
                        ${(d.termMonths > 0) ? `<br><span class="badge badge-blue" style="font-size:9px; margin-top:2px;" title="Срок кредита / аннуитет">📅 ${d.termMonths} мес.</span>` : ''}
                        ${(d.termMonths > 0 && d.amount > 0 && (d.type === 'credit' || d.type === 'auto_mortgage')) ? `<br><span style="font-size:10px; color:var(--accent-green);">≈ ${(typeof calcAnnuity === 'function' ? calcAnnuity(d.amount, d.rate, d.termMonths).toLocaleString('ru-RU') : d.minPay.toLocaleString('ru-RU'))} ₽/мес</span>` : ''}
                    </td>
                    <td style="font-size:11px;">
                        ${graceCellHtml}
                        <div style="color:var(--text-secondary);">День: <input type="text" class="editable-input" style="width:75px; font-size:11px; padding:2px 4px;" value="${escapeHtml(d.dueDate || '25-е')}" onchange="updateDebtField(${d.id}, 'dueDate', this.value)"></div>
                    </td>
                    <td>
                        <span class="badge ${isTopPriority ? 'badge-red' : 'badge-orange'}">${priorityText}</span>
                    </td>
                    <td style="white-space: nowrap;">
                        <button class="btn btn-primary btn-sm" onclick="openDebtModal(${d.id})" title="Полное редактирование в окне">✏️</button>
                        <button class="btn btn-secondary btn-sm" onclick="duplicateDebt(${d.id})" title="Дублировать">📋</button>
                        <button class="btn btn-secondary btn-sm" onclick="deleteDebt(${d.id})" title="Удалить">🗑️</button>
                    </td>
                </tr>
            `;
        });
    }
}

function renderSimulationUI(sim) {
    const badgeElem = document.getElementById('simMonthsBadge');
    if (badgeElem) badgeElem.innerText = `Свобода: ${sim.freedomMonth} (${sim.monthsCount} мес.)`;
    
    const freedomElem = document.getElementById('kpiFreedomDate');
    if (freedomElem) freedomElem.innerText = `Свобода: ${sim.freedomMonth}`;

    const tbody = document.getElementById('simTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        sim.timeline.slice(1).forEach(item => {
            let milestoneBadges = (item.milestones || []).map(m => `<div class="milestone-tag">${escapeHtml(m)}</div>`).join(' ');

            // BUG-10 FIX: Calculate real per-month FCF from dailyEvents instead of showing static "FCF" label
            const monthIncome = (item.dailyEvents || []).filter(ev => ev.category === 'income').reduce((s, ev) => s + (ev.amount || 0), 0);
            const monthExpense = (item.dailyEvents || []).filter(ev => ev.category !== 'income').reduce((s, ev) => s + (ev.amount || 0), 0);
            const monthFcf = monthIncome - monthExpense;
            const fcfColor = monthFcf >= 0 ? 'val-green' : 'val-red';
            const fcfDisplay = `<span class="${fcfColor}"><b>${monthFcf >= 0 ? '+' : ''}${Math.round(monthFcf).toLocaleString('ru-RU')} ₽</b></span>`;

            let statusDisplay = '';
            if (item.total > 0) {
                statusDisplay = `<span class="val-red"><b>${item.total.toLocaleString('ru-RU')} ₽</b></span>`;
            } else {
                statusDisplay = `<span class="val-green"><b>0 ₽</b> (Накоплено: ${item.savingsTotal.toLocaleString('ru-RU')} ₽)</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td><b>${item.month}</b></td>
                    <td>${fcfDisplay}</td>
                    <td style="font-size:11px;">
                        ${item.details}
                        ${milestoneBadges ? '<br>' + milestoneBadges : ''}
                    </td>
                    <td>${statusDisplay}</td>
                </tr>
            `;
        });
    }

    renderSavingsGoalsList(sim);
}

function renderSavingsGoalsList(sim) {
    const goalsContainer = document.getElementById('savingsGoalsList');
    if (!goalsContainer) return;

    goalsContainer.innerHTML = '';

    (sim.goalsProjections || []).forEach(goal => {
        goalsContainer.innerHTML += `
            <div class="goal-item-card">
                <div class="goal-header">
                    <div class="goal-name">${escapeHtml(goal.name)}</div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="badge badge-purple" style="font-size:10px;">${escapeHtml(goal.achievedMonth)}</span>
                        <button class="btn btn-secondary btn-sm" style="padding:2px 6px; border:none; background:transparent; font-size:12px;" onclick="deleteSavingsGoal(${goal.id})" title="Удалить цель">🗑️</button>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary); margin-bottom:8px;">
                    <span>Целевая сумма:</span>
                    <div class="goal-target-box" title="Изменить целевую сумму">
                        <input type="number" class="goal-target-input" value="${goal.target}" onchange="updateGoalTarget(${goal.id}, this.value)">
                        <span class="goal-currency-symbol">₽</span>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${goal.progressPercent}%; background: ${goal.color};"></div>
                </div>
            </div>
        `;
    });
}

/**
 * Dedicated Full-Width Ultra-Detailed Schedule Tab Renderer
 */
function renderDetailedScheduleTab(sim) {
    const cardsContainer = document.getElementById('scheduleCardsContainer');
    const tbody = document.getElementById('scheduleTabTableBody');
    const headerRow = document.getElementById('scheduleTabHeaderRow');

    let points = sim.timeline.slice(1);
    if (scheduleFilterMode === 'debts') {
        points = points.filter(p => p.total > 0 || (p.milestones && p.milestones.length > 0));
    } else if (scheduleFilterMode === 'savings') {
        points = points.filter(p => p.total <= 0);
    }

    // 1. Render Ultra-Detailed Action Cards Mode with Collapsible Month Accordions
    if (cardsContainer) {
        cardsContainer.innerHTML = '';
        points.forEach((p, idx) => {
            let milestoneBadges = (p.milestones || []).map(m => `<div class="milestone-tag">${escapeHtml(m)}</div>`).join(' ');

            let debtCardPills = (p.debtsBreakdown || []).map(b => {
                return `<div class="month-stat-chip ${b.amount > 0 ? 'val-red' : 'val-green'}" style="font-size:11px;">
                    <b>${escapeHtml(b.name)}:</b> ${b.amount > 0 ? b.amount.toLocaleString('ru-RU') + ' ₽' : '0 ₽ (Закрыт)'}
                </div>`;
            }).join(' ');

            // Build Daily Step Items inside this Month
            let dailyStepsHtml = (p.dailyEvents || []).map(ev => {
                const isIncome = ev.category === 'income';
                const isExtra = ev.isExtra;
                const isExcluded = ev.isExcluded;
                const sign = isIncome ? '+' : '-';
                const colorClass = isExcluded ? 'val-secondary' : (isIncome ? 'val-green' : (isExtra ? 'val-red' : 'val-orange'));
                const rowSpecialClass = isExcluded ? 'step-excluded-item' : (isExtra ? 'daily-step-item-extra' : '');
                const runningBal = ev.runningDebtBalance !== undefined ? ev.runningDebtBalance : p.total;
                const runningCash = ev.runningCashBalance !== undefined ? ev.runningCashBalance : p.savingsTotal;
                const isCashGap = ev.isCashGap || (runningCash < 0 && !isExcluded);

                const itemKey = ev.itemKey || `${p.year}-${p.monthIdx}-${ev.category}-${ev.dayNumber}-${ev.debtId ? 'debt_' + ev.debtId : ev.title.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '_')}`;
                const isExec = isItemExecuted(itemKey);
                const execClass = isExec ? 'step-executed' : '';

                if (isExcluded) {
                    return `
                        <div class="daily-step-item step-excluded-item" style="opacity: 0.6; background: rgba(255,255,255,0.02); border: 1px dashed var(--card-border);">
                            <div class="daily-step-left">
                                <span class="day-badge" style="opacity:0.6;">${escapeHtml(ev.dateFormatted)}</span>
                                <div>
                                    <div style="font-weight:600; font-size:12px; text-decoration:line-through; color:var(--text-secondary);">${escapeHtml(ev.title)}</div>
                                    <div style="font-size:10px; color:var(--accent-orange); font-weight:600;">🚫 Пропущено / Отменено в этом месяце</div>
                                </div>
                            </div>
                            <div class="daily-step-right" style="display:flex; align-items:center; gap:8px;">
                                <span style="text-decoration:line-through; font-size:12px; color:var(--text-secondary);">${sign}${(ev.originalAmount || 0).toLocaleString('ru-RU')} ₽</span>
                                <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:2px 8px;" onclick="event.stopPropagation(); toggleExcludedItem('${itemKey}')" title="Восстановить это списание/зачисление в этом месяце">↩️ Восстановить</button>
                            </div>
                        </div>
                    `;
                }

                const isCustom = !!ev.isCustom;
                const origAmt = (ev.originalAmount !== undefined) ? ev.originalAmount : ev.amount;
                const customBadge = isCustom ? `<span class="badge badge-purple" style="font-size:9px; margin-left:4px;" title="Сумма изменена для этого месяца. Базовая плановая: ${origAmt.toLocaleString('ru-RU')} ₽">✏️ Своя сумма</span>` : '';

                return `
                    <div class="daily-step-item ${rowSpecialClass} ${execClass}">
                        <div class="daily-step-left">
                            <input type="checkbox" class="exec-check" ${isExec ? 'checked' : ''} onchange="event.stopPropagation(); toggleExecutedItem('${itemKey}')" title="Отметить платёж как фактически выполненный">
                            <span class="day-badge ${isCashGap ? 'badge-red' : ''}">${escapeHtml(ev.dateFormatted)}</span>
                            <div>
                                <div style="font-weight:600; font-size:12px; ${isExec ? 'text-decoration:line-through; opacity:0.7;' : ''}">${escapeHtml(ev.title)} ${customBadge}</div>
                                <div style="font-size:10px; color:var(--text-secondary);">${escapeHtml(ev.typeLabel)} ${isCustom ? `• <b style="color:var(--accent-purple)">Базовая: ${origAmt.toLocaleString('ru-RU')} ₽</b>` : ''} ${isExec ? '• <b style="color:var(--accent-green)">✔ Выполнено</b>' : ''}</div>
                            </div>
                        </div>
                        <div class="daily-step-right" style="display:flex; align-items:center; gap:8px;">
                            <div style="display:inline-flex; align-items:center; gap:2px;" title="${isCustom ? 'Указана своя сумма. Нажмите ↩️ для сброса к базовой (' + origAmt.toLocaleString('ru-RU') + ' ₽)' : 'Нажмите, чтобы ввести точную реальную сумму для этой операции только в этом месяце'}">
                                <span class="${colorClass}" style="font-weight:700; font-size:12px;">${sign}</span>
                                <input type="number" min="0" step="100" class="editable-input ${colorClass}"
                                    style="width:90px; font-weight:700; font-size:12px; padding:2px 4px; text-align:right; ${isCustom ? 'border-color:var(--accent-purple) !important; background:rgba(168,85,247,0.15) !important;' : ''}"
                                    value="${ev.amount}"
                                    onchange="event.stopPropagation(); setCustomItemAmount('${itemKey}', this.value)">
                                <span class="${colorClass}" style="font-weight:700; font-size:11px;">₽</span>
                                ${isCustom ? `<button class="btn btn-secondary btn-sm" style="padding:1px 5px; font-size:10px; color:var(--accent-purple); border-color:rgba(168,85,247,0.4);" onclick="event.stopPropagation(); resetCustomItemAmount('${itemKey}')" title="Сбросить к базовой плановой сумме (${origAmt.toLocaleString('ru-RU')} ₽)">↩️</button>` : ''}
                            </div>
                            <div class="step-metrics-box">
                                <div style="border-right:1px solid var(--card-border); padding-right:8px; margin-right:8px;">
                                    <div style="font-size:9px; color:var(--text-secondary); font-weight:600;">НАЛИЧНЫЕ</div>
                                    <span class="${runningCash >= 0 ? 'val-blue' : 'val-red'}" style="font-weight:700; font-size:11px;">
                                        ${runningCash >= 0 ? runningCash.toLocaleString('ru-RU') + ' ₽' : '⚠️ ' + runningCash.toLocaleString('ru-RU') + ' ₽'}
                                    </span>
                                </div>
                                <div>
                                    <div style="font-size:9px; color:var(--text-secondary); font-weight:600;">ДОЛГ</div>
                                    <span class="${runningBal > 0 ? 'val-red' : 'val-green'}" style="font-weight:700; font-size:11px;">${runningBal > 0 ? runningBal.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</span>
                                </div>
                            </div>
                            <button class="btn btn-secondary btn-sm" style="padding:2px 6px; color:var(--accent-red); border-color:rgba(239,68,68,0.25); background:rgba(239,68,68,0.06);" onclick="event.stopPropagation(); toggleExcludedItem('${itemKey}')" title="Пропустить / удалить этот платёж только в этом месяце">🗑️</button>
                        </div>
                    </div>
                `;

            }).join('');

            // Keep Month 1 (Current) and Debt Freedom Month expanded by default; collapse others for clean view
            const isFreedomMonth = p.milestones && p.milestones.some(m => m.includes('ОБНУЛЕНЫ') || m.includes('Свобода'));
            const defaultCollapsed = (idx !== 0 && !isFreedomMonth) ? 'collapsed' : '';
            const cardId = `month-card-accordion-${idx}`;

            cardsContainer.innerHTML += `
                <div class="month-detail-card ${defaultCollapsed}" id="${cardId}">
                    <div class="month-header-row" onclick="toggleMonthAccordion('${cardId}')" title="Нажмите, чтобы свернуть/развернуть месяц">
                        <div class="month-title-box">
                            <span class="accordion-chevron">▼</span>
                            <div class="month-name">🗓️ ${escapeHtml(p.month)}</div>
                            <span class="badge ${p.total > 0 ? 'badge-red' : 'badge-green'}">
                                ${p.total > 0 ? 'Итоговый долг: ' + p.total.toLocaleString('ru-RU') + ' ₽' : '🏆 Свобода!'}
                            </span>
                            <span class="badge ${p.savingsTotal >= 0 ? 'badge-purple' : 'badge-red'}">
                                ${p.savingsTotal >= 0 ? 'Остаток средств: ' + p.savingsTotal.toLocaleString('ru-RU') + ' ₽' : '⚠️ Дефицит: ' + p.savingsTotal.toLocaleString('ru-RU') + ' ₽'}
                            </span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary);">
                            Проценты банком: <span class="val-orange"><b>+${p.interestPaidMonth.toLocaleString('ru-RU')} ₽</b></span>
                        </div>
                    </div>

                    <div class="month-collapsible-content">
                        ${milestoneBadges ? `<div style="margin-bottom:10px;">${milestoneBadges}</div>` : ''}

                        <div style="margin-bottom:10px;">
                            <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px; font-weight:600;">Состояние кредитных карт на конец месяца:</div>
                            <div class="month-stats-row">
                                ${debtCardPills}
                            </div>
                        </div>

                        <div style="margin-top:12px;">
                            <div style="font-size:11px; color:var(--accent-blue); margin-bottom:6px; font-weight:700;">📅 Пошаговый план с динамикой наличных средств и остатка долга:</div>
                            <div class="daily-steps-container">
                                ${dailyStepsHtml || '<div style="font-size:11px; color:var(--text-secondary);">Нет операционных списаний</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // 2. Render Overview Table Mode
    if (tbody && headerRow) {
        let dynamicDebtHeaders = appData.debts.map(d => `<th>${escapeHtml(d.name)}</th>`).join('');
        let dynamicGoalHeaders = (appData.savingsGoals || []).map(g => `<th>${escapeHtml(g.name)}</th>`).join('');

        headerRow.innerHTML = `
            <th>Месяц</th>
            <th>Остаток долгов</th>
            ${dynamicDebtHeaders}
            <th>Проценты банком</th>
            <th>Пополнение накоплений</th>
            ${dynamicGoalHeaders}
            <th>События / Вехи</th>
        `;

        tbody.innerHTML = '';

        points.forEach(p => {
            let debtCols = appData.debts.map(d => {
                const b = (p.debtsBreakdown || []).find(item => item.id === d.id);
                const val = b ? b.amount : 0;
                return `<td class="${val > 0 ? 'val-red' : 'val-green'}">${val > 0 ? val.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</td>`;
            }).join('');

            let goalCols = (appData.savingsGoals || []).map(g => {
                const val = (p.goalsState || {})[g.id] || 0;
                return `<td class="val-blue">${val.toLocaleString('ru-RU')} ₽</td>`;
            }).join('');

            let milestoneTags = (p.milestones || []).map(m => `<div class="milestone-tag">${escapeHtml(m)}</div>`).join(' ');

            tbody.innerHTML += `
                <tr class="${p.total === 0 ? 'row-disabled' : ''}">
                    <td><b>${p.month}</b></td>
                    <td class="${p.total > 0 ? 'val-red' : 'val-green'}"><b>${p.total.toLocaleString('ru-RU')} ₽</b></td>
                    ${debtCols}
                    <td class="val-orange">${p.interestPaidMonth > 0 ? '+' + p.interestPaidMonth.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</td>
                    <td class="val-green"><b>${p.savingsDepositMonth > 0 ? '+' + p.savingsDepositMonth.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</b></td>
                    ${goalCols}
                    <td style="font-size:11px;">${milestoneTags || escapeHtml(p.details)}</td>
                </tr>
            `;
        });
    }
}

// FEAT-3: Nearest Payment Notification (today / tomorrow)
function showNearestPaymentNotification() {
    const notifEl = document.getElementById('nearestPaymentNotif');
    if (!notifEl) return;

    const today = new Date();
    const todayDay = today.getDate();
    const tomorrowDay = todayDay + 1;

    // Gather all monthly debts
    const upcoming = [];
    (appData.debts || []).forEach(d => {
        if (d.amount <= 0) return;
        const payDay = (typeof extractDayNumber === 'function') ? extractDayNumber(d.dueDate, 25) : 25;
        const minP = Math.max(0, Number(d.minPay) || 0);
        if (payDay === todayDay) {
            upcoming.push({ label: d.name, amount: minP, when: '🔔 Сегодня' });
        } else if (payDay === tomorrowDay) {
            upcoming.push({ label: d.name, amount: minP, when: '⏰ Завтра' });
        }
    });
    // Check expenses too
    (appData.expenses || []).forEach(e => {
        if (e.enabled === false || e.frequency === 'one_off') return;
        const expDay = (typeof extractDayNumber === 'function') ? extractDayNumber(e.day, 15) : 15;
        if (expDay === todayDay) {
            upcoming.push({ label: e.name, amount: e.amount || 0, when: '🔔 Сегодня' });
        } else if (expDay === tomorrowDay) {
            upcoming.push({ label: e.name, amount: e.amount || 0, when: '⏰ Завтра' });
        }
    });

    if (upcoming.length === 0) {
        notifEl.style.display = 'none';
        return;
    }

    const items = upcoming.map(u =>
        `<span style="display:inline-flex;align-items:center;gap:6px;margin:2px 0;">
            <b>${escapeHtml(u.when)}</b>: ${escapeHtml(u.label)}
            <span class="badge badge-orange" style="font-size:10px;">${(u.amount || 0).toLocaleString('ru-RU')} ₽</span>
        </span>`
    ).join('<br>');

    notifEl.innerHTML = `<span style="font-size:15px;margin-right:6px;">⚡</span> <b>Ближайшие платежи:</b><br>${items}`;
    notifEl.style.display = 'flex';
}

function renderDynamicCalendar(sim) {
    const calBody = document.getElementById('calendarTableBody');
    if (!calBody) return;

    calBody.innerHTML = '';
    let events = [];

    sim.timeline.slice(1).forEach(p => {
        // 1. Incomes
        appData.incomes.forEach(i => {
            if (i.enabled !== false) {
                const isOneOff = i.frequency === 'one_off';
                if (isOneOff && i.oneOffMonth !== p.month) return; // Skip if one-off and not target month

                if (i.scheduleType === 'split') {
                    events.push({
                        month: p.month,
                        categoryType: 'incomes',
                        day: i.advanceDay || '10-е число',
                        event: `💰 Аванс: ${i.name}`,
                        amount: `+${Number(i.advanceAmount || 0).toLocaleString('ru-RU')} ₽`,
                        runningBal: p.total,
                        type: 'Аванс',
                        badgeClass: 'badge-blue'
                    });
                    events.push({
                        month: p.month,
                        categoryType: 'incomes',
                        day: i.mainDay || '25-е число',
                        event: `💼 Основной расчет: ${i.name}`,
                        amount: `+${Number(i.mainAmount || 0).toLocaleString('ru-RU')} ₽`,
                        runningBal: p.total,
                        type: 'Зарплата',
                        badgeClass: 'badge-green'
                    });
                } else {
                    events.push({
                        month: p.month,
                        categoryType: 'incomes',
                        day: i.day || 'В течение месяца',
                        event: `Доход (${CATEGORY_NAMES[i.category || 'other']}): ${i.name}${isOneOff ? ' ⚡ (Разово)' : ''}`,
                        amount: `+${Number(i.amount).toLocaleString('ru-RU')} ₽`,
                        runningBal: p.total,
                        type: isOneOff ? 'Разовый доход' : 'Доход',
                        badgeClass: isOneOff ? 'badge-purple' : 'badge-green'
                    });
                }
            }
        });

        // 2. Active Expenses
        appData.expenses.forEach(e => {
            if (e.enabled !== false) {
                const isOneOff = e.frequency === 'one_off';
                if (isOneOff && e.oneOffMonth !== p.month) return; // Skip if one-off and not target month

                const catName = EXPENSE_CATEGORY_NAMES[e.category || 'other'] || 'Базовый расход';
                events.push({
                    month: p.month,
                    // BUG-9 FIX: expenses must use categoryType 'expenses', not 'debts'
                    // so the 'Debts' filter in calendar doesn't incorrectly show all base expenses
                    categoryType: 'expenses',
                    day: e.day || 'В течение месяца',
                    event: `🛒 Расход (${catName}): ${e.name}${isOneOff ? ' ⚡ (Разово)' : ''}`,
                    amount: `-${Number(e.amount).toLocaleString('ru-RU')} ₽`,
                    runningBal: p.total,
                    type: isOneOff ? 'Разовый расход' : 'Базовый расход',
                    badgeClass: isOneOff ? 'badge-purple' : 'badge-red'
                });
            }
        });

        // 3. Debt Payments
        (p.paymentsBreakdown || []).forEach(pay => {
            if (pay.amount > 0) {
                events.push({
                    month: p.month,
                    categoryType: 'debts',
                    day: 'Ежемесячный платёж',
                    event: `Погашение: ${pay.name}`,
                    amount: `-${pay.amount.toLocaleString('ru-RU')} ₽`,
                    runningBal: p.total,
                    type: 'Выплата долга',
                    badgeClass: 'badge-red'
                });
            }
        });

        // 4. Grace Expirations
        appData.debts.forEach(d => {
            if (d.grace && d.grace !== 'Нет') {
                const gDate = parseGraceDate(d.grace);
                if (gDate && gDate.getFullYear() === p.year && gDate.getMonth() === p.monthIdx) {
                    events.push({
                        month: p.month,
                        categoryType: 'debts',
                        day: d.grace,
                        event: `Конец грейс-периода: ${d.name}`,
                        amount: `Остаток ${p.debtsBreakdown.find(b => b.id === d.id)?.amount || 0} ₽`,
                        runningBal: p.total,
                        type: 'Грейс-период',
                        badgeClass: 'badge-orange'
                    });
                }
            }
        });

        // 5. Savings Deposits
        if (p.savingsDepositMonth > 0) {
            events.push({
                month: p.month,
                categoryType: 'milestones',
                day: 'Конец месяца',
                event: `Пополнение целей (FCF)`,
                amount: `+${p.savingsDepositMonth.toLocaleString('ru-RU')} ₽`,
                runningBal: 0,
                type: 'Накопления',
                badgeClass: 'badge-blue'
            });
        }

        // 6. Milestones & Achievements
        (p.milestones || []).forEach(m => {
            const isGoal = m.includes('Цель') || m.includes('достигнута');
            events.push({
                month: p.month,
                categoryType: 'milestones',
                day: '🎯 Веха / Победа',
                event: m,
                amount: isGoal ? '🏆 Цель достигнута' : '🏁 Долг закрыт',
                runningBal: p.total,
                type: isGoal ? 'Достижение цели' : 'Свобода от долга',
                badgeClass: m.includes('ОБНУЛЕНЫ') ? 'badge-purple' : 'badge-green'
            });
        });
    });

    // Apply Filter
    let filteredEvents = events;
    if (calendarFilterMode === 'debts') {
        // BUG-9 FIX: Only show actual debt payments and grace events, not base expenses
        filteredEvents = events.filter(e => e.categoryType === 'debts');
    } else if (calendarFilterMode === 'milestones') {
        filteredEvents = events.filter(e => e.categoryType === 'milestones');
    } else if (calendarFilterMode === 'incomes') {
        filteredEvents = events.filter(e => e.categoryType === 'incomes');
    }

    filteredEvents.forEach(ev => {
        calBody.innerHTML += `
            <tr>
                <td><b>${escapeHtml(ev.month)}</b> <span style="font-size:11px; color:var(--text-secondary);">(${escapeHtml(ev.day)})</span></td>
                <td><b>${escapeHtml(ev.event)}</b></td>
                <td class="${ev.badgeClass === 'badge-green' || ev.badgeClass === 'badge-blue' ? 'val-green' : 'val-red'}">${escapeHtml(ev.amount)}</td>
                <td class="${ev.runningBal > 0 ? 'val-red' : 'val-green'}"><b>${ev.runningBal > 0 ? ev.runningBal.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</b></td>
                <td><span class="badge ${ev.badgeClass}">${escapeHtml(ev.type)}</span></td>
            </tr>
        `;
    });
}

function renderCharts(totalIncome, totalExpense, sim) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library not loaded yet or blocked.');
        return;
    }

    try {
        const debtCanvas = document.getElementById('debtChart');
    if (debtCanvas) {
        const ctxDebt = debtCanvas.getContext('2d');
        if (debtChartInstance) debtChartInstance.destroy();

        let datasets = [];

        if (currentChartViewMode === 'breakdown') {
            const debtMap = {};
            appData.debts.forEach((d, idx) => {
                const colorConfig = DEBT_COLORS[idx % DEBT_COLORS.length];
                debtMap[d.id] = {
                    label: d.name,
                    data: [],
                    borderColor: colorConfig.border,
                    backgroundColor: colorConfig.bg,
                    fill: false,
                    tension: 0.3,
                    borderWidth: 2.5
                };
            });

            sim.timeline.forEach(point => {
                (point.debtsBreakdown || []).forEach(item => {
                    if (debtMap[item.id]) {
                        debtMap[item.id].data.push(item.amount);
                    }
                });
            });

            datasets = Object.values(debtMap);

            datasets.unshift({
                label: '🔥 Совокупный Долг',
                data: sim.timeline.map(t => t.total),
                borderColor: '#ffffff',
                borderDash: [5, 5],
                fill: false,
                tension: 0.3,
                borderWidth: 2
            });

            (appData.savingsGoals || []).forEach((goal, gIdx) => {
                const color = GOAL_LINE_COLORS[gIdx % GOAL_LINE_COLORS.length];
                datasets.push({
                    label: `${goal.name}`,
                    data: sim.timeline.map(t => (t.goalsState || {})[goal.id] || 0),
                    borderColor: color,
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    borderWidth: 2.5
                });
            });

        } else if (currentChartViewMode === 'comparison') {
            datasets = [
                {
                    label: '⛰️ Стратегия "Лавина"',
                    data: sim.analytics.avalancheTimeline.map(t => t.total),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 3
                },
                {
                    label: '☃️ Стратегия "Снежный ком"',
                    data: sim.analytics.snowballTimeline.map(t => t.total),
                    borderColor: '#a855f7',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    borderWidth: 2
                },
                {
                    label: '🐢 Только мин. платежи (Без досрочки)',
                    data: sim.analytics.minOnlyTimeline.map(t => t.total),
                    borderColor: '#ef4444',
                    borderDash: [4, 4],
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    borderWidth: 2
                }
            ];

        } else if (currentChartViewMode === 'interest') {
            datasets = [{
                label: '💸 Накопленная переплата по процентам (₽)',
                data: sim.timeline.map(t => t.cumInterest),
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                fill: true,
                tension: 0.3,
                borderWidth: 3
            }];
        }

        debtChartInstance = new Chart(ctxDebt, {
            type: 'line',
            data: {
                labels: sim.timeline.map(t => t.month),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString('ru-RU') + ' ₽';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { 
                        ticks: { 
                            color: '#94a3b8', 
                            font: { family: 'Inter', size: 11 },
                            callback: function(val) { return val.toLocaleString('ru-RU') + ' ₽'; } 
                        }, 
                        grid: { color: 'rgba(255,255,255,0.05)' } 
                    }
                }
            }
        });
    }

    const structCanvas = document.getElementById('structureChart');
    if (structCanvas) {
        const ctxStruct = structCanvas.getContext('2d');
        if (structChartInstance) structChartInstance.destroy();

        const fcf = Math.max(0, totalIncome - totalExpense);

        structChartInstance = new Chart(ctxStruct, {
            type: 'doughnut',
            data: {
                labels: ['Базовые расходы', 'Свободный поток (FCF)'],
                datasets: [{
                    data: [totalExpense, fcf],
                    backgroundColor: ['#ef4444', '#22c55e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }
                }
            }
        });
    }

    // Render Expense Categories Donut Chart
    const catCanvas = document.getElementById('expenseCategoriesChart');
    if (catCanvas) {
        const ctxCat = catCanvas.getContext('2d');
        if (expenseCategoriesChartInstance) expenseCategoriesChartInstance.destroy();

        const totalsByCategory = {};
        let totalActiveExpense = 0;
        appData.expenses.forEach(e => {
            if (e.enabled !== false && e.frequency !== 'one_off') {
                const amt = Number(e.amount) || 0;
                const cat = e.category || 'other';
                totalsByCategory[cat] = (totalsByCategory[cat] || 0) + amt;
                totalActiveExpense += amt;
            }
        });

        const catKeys = Object.keys(EXPENSE_CATEGORY_NAMES).filter(k => (totalsByCategory[k] || 0) > 0);
        const labels = catKeys.map(k => EXPENSE_CATEGORY_NAMES[k]);
        const data = catKeys.map(k => totalsByCategory[k]);
        const bgColors = catKeys.map(k => EXPENSE_CATEGORY_COLORS[k] || '#64748b');

        if (data.length === 0) {
            labels.push('Нет расходов');
            data.push(1);
            bgColors.push('#334155');
        }

        expenseCategoriesChartInstance = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                const val = context.parsed;
                                if (val !== null && totalActiveExpense > 0) {
                                    const percent = Math.round((val / totalActiveExpense) * 100);
                                    label += val.toLocaleString('ru-RU') + ' ₽ (' + percent + '%)';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    } catch (err) {
        console.error('Error rendering Chart.js graphs:', err);
    }
}

// FEAT-E: What-If Scenario Comparison
function renderWhatIf(fcf, startingCash, debtsInput) {
    const container = document.getElementById('whatIfContainer');
    if (!container) return;

    const extraInput = document.getElementById('whatIfExtra');
    const extraAmt = extraInput ? (parseFloat(extraInput.value) || 5000) : 5000;

    const horizon = appData.horizonMonths || 24;
    const deepCopy = () => JSON.parse(JSON.stringify(debtsInput));

    const startDay = (appData.startDate && appData.startDate.day) ? appData.startDate.day : 5;
    const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;
    const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : 2026;
    const goalsInput = appData.savingsGoals || [];
    const strategy = appData.strategy || 'avalanche';

    const current = simulateCore(deepCopy(), fcf, startingCash, goalsInput, strategy, startYear, startMonth, startDay, Math.max(horizon, 120));
    const boosted = simulateCore(deepCopy(), fcf + extraAmt, startingCash, goalsInput, strategy, startYear, startMonth, startDay, Math.max(horizon, 120));
    const minOnly = simulateCore(deepCopy(), fcf, startingCash, goalsInput, 'minOnly', startYear, startMonth, startDay, Math.max(horizon, 120));

    const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
    const monthDiff = (a, b) => {
        const d = (b.monthsCount || 0) - (a.monthsCount || 0);
        return d > 0 ? `+${d} мес.` : d < 0 ? `${d} мес.` : '=';
    };

    const scenarioCard = (label, color, icon, sim, refSim, isRef) => {
        const interestK = fmt(sim.totalInterestAccrued);
        const months = sim.monthsCount <= horizon * 5 ? `${sim.monthsCount} мес.` : '> горизонта';
        const freedomLabel = sim.freedomMonth || 'Не достигнута';
        const diff = isRef ? '' : `<span style="font-size:10px; color:var(--text-secondary);">(${monthDiff(sim, refSim)} vs текущий)</span>`;
        return `
            <div class="whatif-card" style="flex:1; min-width:min(160px, 100%); background:${color}; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px;">
                <div style="font-size:13px; font-weight:700; margin-bottom:8px;">${icon} ${label}</div>
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">Свобода от долгов:</div>
                <div style="font-size:14px; font-weight:700; margin-bottom:6px;">${freedomLabel}</div>
                <div style="font-size:11px; color:var(--text-secondary);">Срок: <b>${months}</b> ${diff}</div>
                <div style="font-size:11px; color:var(--accent-red); margin-top:4px;">Переплата: ~${interestK} ₽</div>
            </div>`;
    };

    container.innerHTML = `
        <div class="whatif-grid" style="display:flex; gap:12px; flex-wrap:wrap; align-items:stretch;">
            ${scenarioCard('Текущий план', 'rgba(59,130,246,0.08)', '📌', current, current, true)}
            ${scenarioCard(`+${fmt(extraAmt)} ₽/мес`, 'rgba(34,197,94,0.08)', '🚀', boosted, current, false)}
            ${scenarioCard('Только минималки', 'rgba(239,68,68,0.08)', '🐢', minOnly, current, false)}
        </div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Initial Call
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    recalculateApp();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        recalculateApp();
    });
}
