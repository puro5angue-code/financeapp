/**
 * Finance OS - Financial Simulation Engine
 * Ultra-Detailed Daily Action Steps with Step-by-Step Running Debt Balance & One-Off Income Support
 * Timeline Month 1 Starts in August 2026 (startMonth = 6)
 */

const MONTH_NAMES_RU = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

function parseGraceDate(graceStr, startYear = 2026, startMonth = 7) {
    if (!graceStr || typeof graceStr !== 'string') return null;
    const str = graceStr.trim().toLowerCase();
    if (str === 'нет' || str === '0' || str === '') return null;

    // Relative day count like "120 дней", "55 дней", "100 дней"
    const dayMatch = str.match(/(\d+)\s*(дн|day)/);
    if (dayMatch) {
        const daysCount = parseInt(dayMatch[1], 10);
        if (!isNaN(daysCount) && daysCount > 0) {
            const graceEndDate = new Date(startYear, startMonth, 1);
            graceEndDate.setDate(graceEndDate.getDate() + daysCount);
            return graceEndDate;
        }
    }

    // Extract numbers from strings like "до 7 09", "07.09.2026", "7.09", "7 09 2026"
    const nums = str.match(/\d+/g);
    if (nums && nums.length >= 2) {
        const day = parseInt(nums[0], 10);
        const month = parseInt(nums[1], 10) - 1; // 0-indexed month
        let year = nums.length >= 3 ? parseInt(nums[2], 10) : startYear;
        if (year < 100) year += 2000;

        if (nums.length < 3 && month < startMonth) {
            year = startYear + 1;
        }

        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            return new Date(year, month, day);
        }
    }

    return null;
}

function isGraceActive(graceDate, simYear, simMonthIdx) {
    if (!graceDate) return false;
    const startOfSimMonth = new Date(simYear, simMonthIdx, 1);
    return graceDate >= startOfSimMonth;
}

function roundCents(num) {
    return Math.round((Number(num) || 0) * 100) / 100;
}

function extractDayNumber(dayStr, defaultDay = 15) {
    if (!dayStr) return defaultDay;
    const str = dayStr.toString().toLowerCase();
    if (str.includes('конец')) return 28;
    const match = str.match(/\d+/);
    if (match) {
        const num = parseInt(match[0], 10);
        if (num >= 1 && num <= 31) return num;
    }
    return defaultDay;
}

const CATEGORY_PRIORITY = {
    income: 1,
    expense: 2,
    debt_min: 3,
    debt_combined: 3,
    debt_extra: 4,
    savings: 5
};

/**
 * Simulates financial trajectory with maximum daily step detail & running balance after each transaction
 */
function simulateCore(debtsInput, monthlyFCF, startingCash, savingsGoalsInput = [], strategy = 'avalanche', startYear = 2026, startMonth = 7, startDay = 5, targetHorizonMonths = 24) {
    const startMonthLabel = `${MONTH_NAMES_RU[startMonth]} ${startYear}`;

    let debts = debtsInput.map(d => {
        const fullAmount = Math.max(0, Number(d.amount) || 0);
        const hasStartMonth = !!(d.startMonth && typeof d.startMonth === 'string' && d.startMonth.trim() !== '');
        const isFuturePending = hasStartMonth && (d.startMonth !== startMonthLabel);

        return {
            ...d,
            principal: fullAmount,
            amount: isFuturePending ? 0 : fullAmount,
            isPending: isFuturePending,
            limit: Math.max(0, Number(d.limit) || 0),
            minPay: Math.max(0, Number(d.minPay) || 0),
            rate: Math.max(0, Number(d.rate) || 0)
        };
    });

    // Clone user savings goals
    let goals = (savingsGoalsInput || []).map(g => ({
        id: g.id,
        name: g.name,
        target: Math.max(0, Number(g.target) || 0),
        color: g.color,
        current: 0,
        achieved: false
    }));

    let timeline = [];
    let totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
    let totalInterestAccrued = 0;

    // Initial timeline point
    const initialGoalsState = {};
    goals.forEach(g => initialGoalsState[g.id] = 0);

    timeline.push({
        month: `Старт (${startDay} ${MONTH_NAMES_RU[startMonth].slice(0, 3)})`,
        year: startYear,
        monthIdx: startMonth,
        total: Math.round(totalDebt),
        savingsTotal: startingCash,
        goalsState: initialGoalsState,
        details: 'Текущее состояние',
        debtsBreakdown: debts.map(d => ({ id: d.id, name: d.name, amount: Math.round(d.amount) })),
        paymentsBreakdown: debts.map(d => ({ id: d.id, name: d.name, amount: 0 })),
        dailyEvents: [],
        savingsDepositMonth: 0,
        interestPaidMonth: 0,
        cumInterest: 0,
        milestones: []
    });

    let freedomMonthLabel = null;
    let freedomDateObj = null;
    let debtFreedomMonthIdx = 0;

    let availableCashPoolForGoals = startingCash;
    let runningCashPool = startingCash; // Continuous cash reserves pool across 24-month timeline

    for (let monthIdx = 0; monthIdx < targetHorizonMonths; monthIdx++) {
        const currMonthIdx = (startMonth + monthIdx) % 12;
        const currYear = startYear + Math.floor((startMonth + monthIdx) / 12);
        const monthLabel = `${MONTH_NAMES_RU[currMonthIdx]} ${currYear}`;

        let milestones = [];

        // Check if any pending future debts activate this month
        debts.forEach(d => {
            if (d.isPending && d.startMonth === monthLabel) {
                d.isPending = false;
                d.amount = d.principal;
                totalDebt += d.amount;
                milestones.push(`🚗 Взятие кредита / начало выплат по «${d.name}»: +${Math.round(d.amount).toLocaleString('ru-RU')} ₽ (${monthLabel})`);
            }
        });

        // Support for Regular vs One-Off Incomes (Vacation Pay, Tax Returns)
        const activeIncomes = (appData.incomes || []).filter(i => {
            if (i.enabled === false) return false;
            if (i.frequency === 'one_off') {
                return i.oneOffMonth === monthLabel;
            }
            return true;
        });
        const activeExpenses = (appData.expenses || []).filter(e => {
            if (e.enabled === false) return false;
            if (e.frequency === 'one_off') {
                return e.oneOffMonth === monthLabel;
            }
            return true;
        });

        let monthInterestAccrued = 0;
        let paymentLog = [];
        let paymentsPerDebt = {};
        debts.forEach(d => paymentsPerDebt[d.id] = 0);

        let savingsDepositThisMonth = 0;
        let dailyEvents = [];
        let runningDebtBalance = debts.reduce((sum, d) => sum + d.amount, 0);

        // Grace Period Expiration Milestone Checks
        debts.forEach(d => {
            if (!d.isPending && d.amount > 0 && d.grace) {
                const gDate = parseGraceDate(d.grace, startYear, startMonth);
                if (gDate) {
                    const activeNow = isGraceActive(gDate, currYear, currMonthIdx);
                    if (!activeNow && !d.graceAlerted) {
                        d.graceAlerted = true;
                        milestones.push(`⚠️ Истёк льготный период по «${d.name}»! Включается ${d.rate}% годовых.`);
                    }
                }
            }
        });

        // 1. Build Incomes Daily Steps
        activeIncomes.forEach(inc => {
            const isOneOff = inc.frequency === 'one_off';
            const oneOffBadge = isOneOff ? ' ⚡ (Разово)' : '';

            if (inc.scheduleType === 'split') {
                const advDayNum = extractDayNumber(inc.advanceDay, 10);
                const mainDayNum = extractDayNumber(inc.mainDay, 25);

                const advKey = `${currYear}-${currMonthIdx}-income-${advDayNum}-${inc.id}_adv`;
                const isAdvExcluded = isItemExcluded(advKey);
                const customAdv = (typeof getCustomItemAmount === 'function') ? getCustomItemAmount(advKey) : null;
                const isAdvCustom = customAdv !== null && customAdv !== undefined;
                const advAmount = isAdvExcluded ? 0 : (isAdvCustom ? customAdv : (inc.advanceAmount || 0));

                if (monthIdx > 0 || advDayNum >= startDay) {
                    dailyEvents.push({
                        dayNumber: advDayNum,
                        dateFormatted: `${advDayNum}-е число`,
                        category: 'income',
                        title: `💼 Аванс: ${inc.name}${oneOffBadge}`,
                        amount: advAmount,
                        originalAmount: inc.advanceAmount || 0,
                        typeLabel: isAdvCustom ? 'Зачисление аванса (Уточнено)' : 'Зачисление аванса',
                        badgeClass: 'badge-blue',
                        itemKey: advKey,
                        isExcluded: isAdvExcluded,
                        isCustom: isAdvCustom
                    });
                }

                const mainKey = `${currYear}-${currMonthIdx}-income-${mainDayNum}-${inc.id}_main`;
                const isMainExcluded = isItemExcluded(mainKey);
                const customMain = (typeof getCustomItemAmount === 'function') ? getCustomItemAmount(mainKey) : null;
                const isMainCustom = customMain !== null && customMain !== undefined;
                const mainAmount = isMainExcluded ? 0 : (isMainCustom ? customMain : (inc.mainAmount || 0));

                if (monthIdx > 0 || mainDayNum >= startDay) {
                    dailyEvents.push({
                        dayNumber: mainDayNum,
                        dateFormatted: `${mainDayNum}-е число`,
                        category: 'income',
                        title: `💼 Основной расчёт: ${inc.name}${oneOffBadge}`,
                        amount: mainAmount,
                        originalAmount: inc.mainAmount || 0,
                        typeLabel: isMainCustom ? 'Зачисление зарплаты (Уточнено)' : 'Зачисление зарплаты',
                        badgeClass: 'badge-green',
                        itemKey: mainKey,
                        isExcluded: isMainExcluded,
                        isCustom: isMainCustom
                    });
                }
            } else if (inc.scheduleType === 'single') {
                const sDayNum = extractDayNumber(inc.singleDay, 20);
                const sKey = `${currYear}-${currMonthIdx}-income-${sDayNum}-${inc.id}`;
                const isSExcluded = isItemExcluded(sKey);
                const customS = (typeof getCustomItemAmount === 'function') ? getCustomItemAmount(sKey) : null;
                const isSCustom = customS !== null && customS !== undefined;
                const sAmount = isSExcluded ? 0 : (isSCustom ? customS : (inc.amount || 0));

                if (monthIdx > 0 || sDayNum >= startDay) {
                    dailyEvents.push({
                        dayNumber: sDayNum,
                        dateFormatted: `${sDayNum}-е число`,
                        category: 'income',
                        title: `💰 Доход: ${inc.name}${oneOffBadge}`,
                        amount: sAmount,
                        originalAmount: inc.amount || 0,
                        typeLabel: isSCustom ? 'Поступление (Уточнено)' : (isOneOff ? 'Разовое поступление' : 'Поступление средств'),
                        badgeClass: isOneOff ? 'badge-purple' : 'badge-green',
                        itemKey: sKey,
                        isExcluded: isSExcluded,
                        isCustom: isSCustom
                    });
                }
            } else {
                const flexDayNum = extractDayNumber(inc.day, 15);
                const flexKey = `${currYear}-${currMonthIdx}-income-${flexDayNum}-${inc.id}`;
                const isFlexExcluded = isItemExcluded(flexKey);
                const customFlex = (typeof getCustomItemAmount === 'function') ? getCustomItemAmount(flexKey) : null;
                const isFlexCustom = customFlex !== null && customFlex !== undefined;
                const flexAmount = isFlexExcluded ? 0 : (isFlexCustom ? customFlex : (inc.amount || 0));

                if (monthIdx > 0 || flexDayNum >= startDay) {
                    dailyEvents.push({
                        dayNumber: flexDayNum,
                        dateFormatted: `${flexDayNum}-е число`,
                        category: 'income',
                        title: `💻 Доход: ${inc.name}${oneOffBadge}`,
                        amount: flexAmount,
                        originalAmount: inc.amount || 0,
                        typeLabel: isFlexCustom ? 'Подработка (Уточнено)' : 'Подработка',
                        badgeClass: 'badge-green',
                        itemKey: flexKey,
                        isExcluded: isFlexExcluded,
                        isCustom: isFlexCustom
                    });
                }
            }
        });

        // 2. Build Expenses Daily Steps
        activeExpenses.forEach(exp => {
            const isOneOff = exp.frequency === 'one_off';
            const oneOffBadge = isOneOff ? ' ⚡ (Разово)' : '';
            const expDayNum = extractDayNumber(exp.day, 15);
            const expKey = `${currYear}-${currMonthIdx}-expense-${expDayNum}-${exp.id}`;
            const isExpExcluded = isItemExcluded(expKey);
            const customExp = (typeof getCustomItemAmount === 'function') ? getCustomItemAmount(expKey) : null;
            const isExpCustom = customExp !== null && customExp !== undefined;
            const expAmount = isExpExcluded ? 0 : (isExpCustom ? customExp : (exp.amount || 0));

            if (monthIdx > 0 || expDayNum >= startDay) {
                dailyEvents.push({
                    dayNumber: expDayNum,
                    dateFormatted: `${expDayNum}-е число`,
                    category: 'expense',
                    title: `🛒 Расход: ${exp.name}${oneOffBadge}`,
                    amount: expAmount,
                    originalAmount: exp.amount || 0,
                    typeLabel: isExpCustom ? 'Расход (Уточнено)' : (isOneOff ? 'Разовый расход' : 'Базовый расход'),
                    badgeClass: isOneOff ? 'badge-purple' : 'badge-red',
                    itemKey: expKey,
                    isExcluded: isExpExcluded,
                    isCustom: isExpCustom
                });
            }
        });

        // Compute actual FCF for this month based on active events in this month
        const currentMonthIncomeTotal = dailyEvents.filter(ev => ev.category === 'income').reduce((sum, ev) => sum + ev.amount, 0);
        const currentMonthExpenseTotal = dailyEvents.filter(ev => ev.category === 'expense').reduce((sum, ev) => sum + ev.amount, 0);
        const currentMonthFCF = currentMonthIncomeTotal - currentMonthExpenseTotal;

        if (totalDebt > 0) {
            // 3. Accrue Interest
            debts.forEach(d => {
                if (d.amount > 0.01) {
                    const gDate = parseGraceDate(d.grace, startYear, startMonth);
                    const graceValid = isGraceActive(gDate, currYear, currMonthIdx);
                    if (!graceValid && d.rate > 0) {
                        const interest = d.amount * (d.rate / 100 / 12);
                        d.amount += interest;
                        monthInterestAccrued += interest;
                    }
                }
            });

            totalInterestAccrued += monthInterestAccrued;
            runningDebtBalance += monthInterestAccrued;

            // Calculate total mandatory minimum payments required
            let totalMinPayNeeded = 0;
            debts.forEach(d => {
                if (d.amount > 0.01) {
                    const payDayNum = extractDayNumber(d.dueDate, 25);
                    if (monthIdx === 0 && payDayNum < startDay) return;
                    const debtKey = `${currYear}-${currMonthIdx}-debt-${payDayNum}-${d.id}`;
                    if (isItemExcluded(debtKey)) return;

                    const minReq = (!d.type || d.type === 'card') 
                        ? Math.min(d.amount, Math.max(d.minPay || 0, Math.round(d.amount * 0.03)))
                        : Math.min(d.amount, d.minPay || 0);
                    totalMinPayNeeded += minReq;
                }
            });

            // 4. Minimum Payments Calculation & Daily Event Building
            debts.forEach(d => {
                if (d.amount > 0.01) {
                    const payDayNum = extractDayNumber(d.dueDate, 25);
                    if (monthIdx === 0 && payDayNum < startDay) return;
                    const debtKey = `${currYear}-${currMonthIdx}-debt-${payDayNum}-${d.id}`;
                    const isDebtExcluded = isItemExcluded(debtKey);

                    const minReq = (!d.type || d.type === 'card') 
                        ? Math.min(d.amount, Math.max(d.minPay || 0, Math.round(d.amount * 0.03)))
                        : Math.min(d.amount, d.minPay || 0);

                    if (minReq > 0) {
                        const actualMinReq = isDebtExcluded ? 0 : minReq;
                        d.amount = Math.max(0, Math.round((d.amount - actualMinReq) * 100) / 100);
                        if (d.amount < 0.01) d.amount = 0;
                        runningDebtBalance -= actualMinReq;
                        paymentsPerDebt[d.id] = (paymentsPerDebt[d.id] || 0) + actualMinReq;
                        if (!isDebtExcluded) {
                            paymentLog.push(`${d.name}: мин. ${Math.round(actualMinReq).toLocaleString('ru-RU')} ₽`);
                        }
                        dailyEvents.push({
                            dayNumber: payDayNum,
                            dateFormatted: `${payDayNum}-е число`,
                            category: 'debt_min',
                            title: `💳 Мин. платёж: ${d.name}`,
                            amount: Math.round(actualMinReq),
                            originalAmount: Math.round(minReq),
                            typeLabel: isDebtExcluded ? 'Мин. платёж (Пропущен)' : 'Мин. платёж',
                            badgeClass: isDebtExcluded ? 'badge-secondary' : 'badge-orange',
                            debtId: d.id,
                            itemKey: debtKey,
                            isExcluded: isDebtExcluded,
                            runningDebtBalance: Math.max(0, Math.round(runningDebtBalance))
                        });
                    }
                }
            });

            // 5. Priority Extra Payoff & Daily Event Building
            // ARCHITECTURE: Extra payments are NOT pre-deducted from runningCashPool.
            // They are added to dailyEvents as normal debit events and processed by dayCashTracker
            // in chronological order. Income (day 10, 25) always arrives BEFORE extra payments (day 28),
            // so there is no cash-gap risk. Pre-deducting from runningCashPool caused dayCashTracker
            // to start negative -> false buffer drawdowns -> debt grew back each month.
            //
            // extraAvailablePool = runningCashPool (pure carryover). Min payments are covered by
            // current-month income flowing through dayCashTracker, not by the carryover reservation.
            if (strategy !== 'minOnly' && runningCashPool > 0) {
                let activeDebts = debts.filter(d => d.amount > 0.01);
                let extraAvailablePool = Math.max(0, runningCashPool);

                // Prioritize strictGrace debts first, then grace active debts, then strategy
                activeDebts.sort((a, b) => {
                    const strictA = !!a.strictGrace;
                    const strictB = !!b.strictGrace;
                    if (strictA && !strictB) return -1;
                    if (!strictA && strictB) return 1;

                    const gDateA = parseGraceDate(a.grace, startYear, startMonth);
                    const gDateB = parseGraceDate(b.grace, startYear, startMonth);
                    const graceActiveA = isGraceActive(gDateA, currYear, currMonthIdx);
                    const graceActiveB = isGraceActive(gDateB, currYear, currMonthIdx);

                    if (graceActiveA && !graceActiveB) return -1;
                    if (!graceActiveA && graceActiveB) return 1;
                    if (graceActiveA && graceActiveB && gDateA && gDateB) {
                        return gDateA - gDateB; // Earlier grace deadline first
                    }
                    if (strategy === 'snowball') {
                        return (a.amount - b.amount) || (b.rate - a.rate);
                    } else {
                        return (b.rate - a.rate) || (a.amount - b.amount);
                    }
                });

                activeDebts.forEach(d => {
                    if (d.amount > 0.01 && extraAvailablePool > 0) {
                        const isStrict = !!d.strictGrace;
                        const gDate = parseGraceDate(d.grace, startYear, startMonth);
                        
                        let targetPay = d.amount;
                        if (isStrict && gDate) {
                            const mRem = Math.max(1, (gDate.getFullYear() - currYear) * 12 + (gDate.getMonth() - currMonthIdx) + 1);
                            if (mRem > 1) {
                                targetPay = Math.min(d.amount, Math.ceil(d.amount / mRem));
                            } else {
                                targetPay = d.amount; // Last grace month: must pay 100% of remaining balance!
                            }

                            if (extraAvailablePool < targetPay) {
                                const def = targetPay - extraAvailablePool;
                                milestones.push(`⚠️ [Риск вылета из грейса] По «${d.name}» не хватает ${Math.round(def).toLocaleString('ru-RU')} ₽ для гарантированного обнуления к ${d.grace}!`);
                            }
                        }

                        const extraPay = Math.min(targetPay, extraAvailablePool);
                        if (extraPay > 0) {
                            d.amount = Math.max(0, Math.round((d.amount - extraPay) * 100) / 100);
                            if (d.amount < 0.01) d.amount = 0;
                            extraAvailablePool -= extraPay;
                            // NOTE: Do NOT deduct from runningCashPool here.
                            // dayCashTracker processes extra events as normal debits (single deduction).
                            runningDebtBalance -= extraPay;
                            paymentsPerDebt[d.id] = (paymentsPerDebt[d.id] || 0) + extraPay;
                            paymentLog.push(`${d.name}: +досрочно ${Math.round(extraPay).toLocaleString('ru-RU')} ₽`);

                            let extraDayNum = extractDayNumber(d.dueDate, 25);
                            if (isStrict && gDate && currYear === gDate.getFullYear() && currMonthIdx === gDate.getMonth()) {
                                extraDayNum = Math.min(extraDayNum, gDate.getDate());
                            }

                            const labelTitle = isStrict ? `🔥 ГРЕЙС-ДЕДЛАЙН: ${d.name}` : `🔥 ДОСРОЧКА (${strategy === 'snowball' ? 'Снежный ком' : 'Лавина'}): ${d.name}`;

                            // Consolidate same-day minimum + extra payments for same debt into a single clean event
                            const existingMinEv = dailyEvents.find(ev => ev.debtId === d.id && (ev.category === 'debt_min' || ev.category === 'debt_combined') && ev.dayNumber === extraDayNum);
                            if (existingMinEv) {
                                const minAmt = existingMinEv.amount;
                                const totalPayAmt = minAmt + Math.round(extraPay);
                                existingMinEv.category = 'debt_combined';
                                existingMinEv.title = isStrict ? `🔥 ГРЕЙС-ДЕДЛАЙН + ПЛАТЁЖ: ${d.name}` : `🔥 ПЛАТЁЖ + ДОСРОЧКА: ${d.name}`;
                                existingMinEv.amount = totalPayAmt; // dayCashTracker deducts the full combined amount
                                existingMinEv.typeLabel = `Мин. ${minAmt.toLocaleString('ru-RU')} ₽ + ${isStrict ? 'Грейс-квота' : 'Досрочно'} ${Math.round(extraPay).toLocaleString('ru-RU')} ₽`;
                                existingMinEv.badgeClass = 'badge-red';
                                existingMinEv.isExtra = true;
                                // No preDeducted/extraPreDeducted — dayCashTracker handles full amount normally
                                delete existingMinEv.preDeducted;
                                delete existingMinEv.extraPreDeducted;
                                existingMinEv.runningDebtBalance = Math.max(0, Math.round(runningDebtBalance));
                            } else {
                                dailyEvents.push({
                                    dayNumber: extraDayNum,
                                    dateFormatted: `${extraDayNum}-е число`,
                                    category: 'debt_extra',
                                    title: labelTitle,
                                    amount: Math.round(extraPay),
                                    typeLabel: isStrict ? '🔥 Обязательный грейс-платеж' : '🔥 Досрочное гашение',
                                    badgeClass: 'badge-red',
                                    debtId: d.id,
                                    isExtra: true,
                                    // No preDeducted — dayCashTracker deducts normally (single, correct deduction)
                                    runningDebtBalance: Math.max(0, Math.round(runningDebtBalance))
                                });
                            }
                        }
                    }
                });
            }

            // Milestone Checks
            debts.forEach(d => {
                if (d.amount <= 0 && !d.wasClosed) {
                    d.wasClosed = true;
                    milestones.push(`🎉 ${d.name} закрыт!`);
                }
            });

            totalDebt = debts.reduce((sum, d) => sum + Math.max(0, d.amount), 0);

            if (totalDebt <= 0 && !freedomDateObj) {
                freedomMonthLabel = monthLabel;
                freedomDateObj = { year: currYear, monthIdx: currMonthIdx };
                debtFreedomMonthIdx = monthIdx + 1;
                milestones.push(`🏁 ВСЕ ДОЛГИ ОБНУЛЕНЫ!`);
            }
        } else {
            // Post-debt Accumulation Phase
            if (currentMonthFCF > 0 && strategy !== 'minOnly') {
                savingsDepositThisMonth = currentMonthFCF;
                paymentLog.push(`🎯 В накопления: +${Math.round(currentMonthFCF).toLocaleString('ru-RU')} ₽`);
                dailyEvents.push({
                    dayNumber: 28,
                    dateFormatted: `28-е число`,
                    category: 'savings',
                    title: `🛡️ Пополнение накоплений (FCF)`,
                    amount: Math.round(currentMonthFCF),
                    typeLabel: 'Накопления',
                    badgeClass: 'badge-purple',
                    runningDebtBalance: 0
                });
            } else {
                paymentLog.push(`Все долги закрыты!`);
            }
        }

        // Sort Daily Action Events Chronologically by Day Number with strict Category Priority
        dailyEvents.sort((a, b) => {
            if (a.dayNumber !== b.dayNumber) {
                return a.dayNumber - b.dayNumber;
            }
            return (CATEGORY_PRIORITY[a.category] || 99) - (CATEGORY_PRIORITY[b.category] || 99);
        });

        // Step-by-step Daily Running Cash Balance tracking & Cash Gap Detection with Automatic Buffer Drawdown
        let dayCashTracker = runningCashPool;
        dailyEvents.forEach(ev => {
            if (ev.category === 'income') {
                dayCashTracker += Number(ev.amount) || 0;
            } else {
                // Deduct all non-income events (expenses, min, extra, combined) normally.
                // No preDeducted logic needed — extra payments are never pre-deducted from runningCashPool.
                dayCashTracker -= Number(ev.amount) || 0;
            }

            if (dayCashTracker < 0) {
                // Automatic Credit Buffer Drawdown
                const deficitAmt = Math.abs(dayCashTracker);
                // Exclude ev.debtId to prevent self-referential payment loops (e.g. T-Bank paying T-Bank)
                const bufferCards = debts.filter(d => !d.isPending && (!d.type || d.type === 'card') && d.allowBuffer !== false && d.id !== ev.debtId && (d.limit - d.amount) > 10);
                if (bufferCards.length > 0) {
                    bufferCards.sort((a, b) => (b.limit - b.amount) - (a.limit - a.amount));
                    const bufCard = bufferCards[0];
                    const availLimit = bufCard.limit - bufCard.amount;
                    const drawAmt = Math.min(deficitAmt, availLimit);

                    if (drawAmt > 0) {
                        bufCard.amount += drawAmt;
                        dayCashTracker += drawAmt;
                        runningDebtBalance += drawAmt;
                        totalDebt = debts.reduce((sum, d) => sum + Math.max(0, d.amount), 0);

                        const graceDaysCount = bufCard.graceDays || 55;
                        const newGraceDate = new Date(currYear, currMonthIdx, Math.min(28, ev.dayNumber));
                        newGraceDate.setDate(newGraceDate.getDate() + graceDaysCount);
                        
                        const dd = String(newGraceDate.getDate()).padStart(2, '0');
                        const mm = String(newGraceDate.getMonth() + 1).padStart(2, '0');
                        const yyyy = newGraceDate.getFullYear();
                        const newGraceStr = `${dd}.${mm}.${yyyy}`;
                        bufCard.grace = newGraceStr;
                        bufCard.graceAlerted = false;

                        ev.typeLabel += ` | 🛡️ Перекрыто буфером «${bufCard.name}» (+${Math.round(drawAmt).toLocaleString('ru-RU')} ₽, новый грейс до ${newGraceStr})`;
                        milestones.push(`🛡️ Задействован кредитный буфер: +${Math.round(drawAmt).toLocaleString('ru-RU')} ₽ с «${bufCard.name}». Новый грейс до ${newGraceStr}.`);
                    }
                }

                if (dayCashTracker < 0) {
                    ev.isCashGap = true;
                    ev.badgeClass = 'badge-red';
                    if (!ev.title.includes('⚠️')) {
                        ev.title = `⚠️ [Кассовый разрыв] ${ev.title}`;
                    }
                }
            }

            ev.runningCashBalance = Math.round(dayCashTracker);
            ev.runningDebtBalance = Math.max(0, Math.round(runningDebtBalance));
        });

        // Update end-of-month continuous running cash pool
        runningCashPool = dayCashTracker;
        availableCashPoolForGoals = Math.max(0, runningCashPool);

        if (runningCashPool < 0) {
            milestones.push(`⚠️ Кассовый дефицит к концу месяца: ${Math.round(runningCashPool).toLocaleString('ru-RU')} ₽!`);
        }

        // Sequential Goal Accumulation Logic
        // BUG-3 FIX: Goals must accumulate cumulatively over months, not reset each month.
        // We treat availableCashPoolForGoals as the total accumulated cash at end of month.
        // Goals are filled sequentially: Goal-1 gets priority, Goal-2 gets overflow, etc.
        let remainingCashToAllocate = availableCashPoolForGoals;
        let currentGoalsState = {};

        goals.forEach(g => {
            if (!g.achieved) {
                if (remainingCashToAllocate > 0) {
                    // Allocate as much as possible toward this goal (cumulative, up to target)
                    const allocated = Math.min(g.target, remainingCashToAllocate);
                    g.current = allocated; // This IS cumulative because availableCashPoolForGoals tracks running cash
                    remainingCashToAllocate -= allocated;

                    if (g.current >= g.target && !g.achieved) {
                        g.achieved = true;
                        g.achievedMonth = monthLabel;
                        milestones.push(`🎯 Цель "${g.name}" достигнута! (${monthLabel})`);
                    }
                } else {
                    g.current = 0;
                }
            } else {
                // Already achieved — keep at target, don't reduce remainingCash further
                // (it was already deducted in a previous month)
                g.current = g.target;
            }
            currentGoalsState[g.id] = Math.round(g.current);
        });

        timeline.push({
            month: monthLabel,
            year: currYear,
            monthIdx: currMonthIdx,
            total: Math.max(0, Math.round(totalDebt)),
            savingsTotal: Math.round(availableCashPoolForGoals),
            savingsDepositMonth: Math.round(savingsDepositThisMonth),
            goalsState: currentGoalsState,
            details: paymentLog.join(' | ') || '🎉 Свобода!',
            debtsBreakdown: debts.map(d => ({ id: d.id, name: d.name, amount: Math.max(0, Math.round(d.amount)) })),
            paymentsBreakdown: debts.map(d => ({ id: d.id, name: d.name, amount: Math.round(paymentsPerDebt[d.id] || 0) })),
            dailyEvents,
            interestPaidMonth: Math.round(monthInterestAccrued),
            cumInterest: Math.round(totalInterestAccrued),
            milestones
        });
    }

    return {
        monthsCount: debtFreedomMonthIdx || targetHorizonMonths,
        timeline,
        freedomMonth: freedomMonthLabel || 'Долги выплачиваются',
        freedomDateObj,
        totalInterestAccrued: Math.round(totalInterestAccrued),
        goalsSummary: goals
    };
}

/**
 * Runs Financial Simulation over configurable horizon
 * horizon defaults to appData.horizonMonths (set in settings) or 24 months
 */
function runFinancialSimulation(debtsInput, monthlyFCF, startingCash, strategy = 'avalanche', horizonMonths = null) {
    const horizon = horizonMonths || (appData.horizonMonths || 24);
    const goalsInput = appData.savingsGoals || [];
    const startDay = (appData.startDate && appData.startDate.day) ? appData.startDate.day : 5;
    const startMonth = (appData.startDate && appData.startDate.monthIdx !== undefined) ? appData.startDate.monthIdx : 7;
    const startYear = (appData.startDate && appData.startDate.year) ? appData.startDate.year : 2026;

    // BUG-4 FIX: Deep-copy debtsInput before each simulateCore call to prevent object mutation
    // across simulation runs (interest accrual mutates d.amount in-place)
    const deepCopy = () => JSON.parse(JSON.stringify(debtsInput));

    const mainSim = simulateCore(deepCopy(), monthlyFCF, startingCash, goalsInput, strategy, startYear, startMonth, startDay, horizon);
    const avalancheSim = strategy === 'avalanche' ? mainSim : simulateCore(deepCopy(), monthlyFCF, startingCash, goalsInput, 'avalanche', startYear, startMonth, startDay, horizon);
    const snowballSim = strategy === 'snowball' ? mainSim : simulateCore(deepCopy(), monthlyFCF, startingCash, goalsInput, 'snowball', startYear, startMonth, startDay, horizon);
    const minOnlySim = simulateCore(deepCopy(), monthlyFCF, startingCash, goalsInput, 'minOnly', startYear, startMonth, startDay, Math.max(horizon, 120));

    const interestSaved = Math.max(0, minOnlySim.totalInterestAccrued - mainSim.totalInterestAccrued);
    const monthsSaved = Math.max(0, minOnlySim.monthsCount - mainSim.monthsCount);

    // Goal Projections with exact completion dates
    const goalsProjections = (mainSim.goalsSummary || []).map(g => {
        const target = Number(g.target) || 0;
        let achievedMonth = g.achievedMonth ? `~${g.achievedMonth}` : (mainSim.monthsCount > horizon ? 'После долгов' : 'В процессе');
        let progressPercent = Math.min(100, Math.round((g.current / (target || 1)) * 100));

        return {
            id: g.id,
            name: g.name,
            target: target,
            current: g.current,
            color: g.color,
            achievedMonth,
            progressPercent
        };
    });

    return {
        monthsCount: mainSim.monthsCount,
        timeline: mainSim.timeline,
        freedomMonth: mainSim.freedomMonth,
        freedomDateObj: mainSim.freedomDateObj,
        goalsProjections,
        minOnlySim,   // exposed for What-If comparisons
        analytics: {
            interestPaid: mainSim.totalInterestAccrued,
            interestSaved: interestSaved,
            monthsSaved: monthsSaved,
            avalancheTimeline: avalancheSim.timeline,
            snowballTimeline: snowballSim.timeline,
            minOnlyTimeline: minOnlySim.timeline
        }
    };
}
