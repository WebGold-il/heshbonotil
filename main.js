// משתנים גלובליים לגרפים
window.charts = {
  monthly: null,
  category: null
};

// טעינת הנתונים בעת טעינת הדף
window.addEventListener('DOMContentLoaded', function() {
  // טעינת הנתונים מה-localStorage
  updateTable();
  updateCategoryFilter();
  updateCharts();
  
  // עדכון הפילטר בטעינת הדף
  updateCategoryFilter();
  const savedCategory = localStorage.getItem('selectedCategory');
  if (savedCategory) {
    document.getElementById('categoryFilter').value = savedCategory;
    filterByCategory();
  }
});

// פונקציה לבדיקת כפילויות
function findDuplicates(newExpenses, existingExpenses) {
  const duplicates = [];
  const unique = [];
  
  for (const newExp of newExpenses) {
    const isDuplicate = existingExpenses.some(existingExp => 
      existingExp.date === newExp.date && 
      existingExp.description === newExp.description && 
      Math.abs(parseFloat(existingExp.amount) - parseFloat(newExp.amount)) < 0.01 &&
      existingExp.category === newExp.category
    );
    
    if (isDuplicate) {
      duplicates.push(newExp);
    } else {
      unique.push(newExp);
    }
  }
  
  return { duplicates, unique };
}

// פונקציה להצגת הכפילויות במודל
window.showDuplicatesModal = function(duplicates) {
  const duplicatesTable = document.querySelector('#duplicatesModal tbody');
  if (!duplicatesTable) return;
  
  // ניקוי הטבלה
  duplicatesTable.innerHTML = '';
  
  // הוספת השורות החדשות
  duplicates.forEach(expense => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${expense.date}</td>
      <td>${expense.description}</td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>${expense.category}</td>
      <td>${expense.notes || ''}</td>
    `;
    duplicatesTable.appendChild(row);
  });
  
  // הצגת המודל
  const modal = new bootstrap.Modal(document.getElementById('duplicatesModal'));
  modal.show();
}

// פונקציה לטיפול בנתונים
window.processData = function() {
  const input = document.getElementById('expenseInput');
  if (!input || !input.value.trim()) {
    showErrorMessage('נא להזין נתונים');
    return;
  }

  try {
    const existingExpenses = JSON.parse(localStorage.getItem('expenses') || '[]');
    const newExpenses = parseCSVData(input.value);
    
    // בדיקת כפילויות
    const { duplicates, unique } = findDuplicates(newExpenses, existingExpenses);
    
    if (duplicates.length > 0) {
      showDuplicatesModal(duplicates);
      showWarningMessage(`נמצאו ${duplicates.length} כפילויות. רק ${unique.length} הוצאות חדשות נוספו.`);
    }
    
    // הוספת רק ההוצאות הייחודיות
    const allExpenses = [...existingExpenses, ...unique];
    localStorage.setItem('expenses', JSON.stringify(allExpenses));
    
    // עדכון הממשק
    updateCategoryFilter();
    updateTable();
    updateCharts();
    
    // ניקוי שדה הקלט
    input.value = '';
    
    if (unique.length > 0) {
      showSuccessMessage(`נוספו ${unique.length} הוצאות חדשות בהצלחה`);
    }
  } catch (error) {
    showErrorMessage('שגיאה בעיבוד הנתונים: ' + error.message);
  }
}

// פונקציה להצגת הודעת אזהרה
function showWarningMessage(message) {
  const alertsContainer = document.getElementById('alertsContainer');
  if (!alertsContainer) return;

  const alert = document.createElement('div');
  alert.className = 'alert alert-warning alert-dismissible fade show';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  alertsContainer.appendChild(alert);
  
  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => alert.remove(), 150);
  }, 5000);
}

// פונקציה להצגת הודעת הצלחה
function showSuccessMessage(message) {
  const alertsContainer = document.getElementById('alertsContainer');
  if (!alertsContainer) return;

  const alert = document.createElement('div');
  alert.className = 'alert alert-success alert-dismissible fade show';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  alertsContainer.appendChild(alert);
  
  // הסרה אוטומטית אחרי 3 שניות
  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => alert.remove(), 150);
  }, 3000);
}

// פונקציה להצגת הודעת שגיאה
function showErrorMessage(message) {
  const alertsContainer = document.getElementById('alertsContainer');
  if (!alertsContainer) return;

  const alert = document.createElement('div');
  alert.className = 'alert alert-danger alert-dismissible fade show';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  alertsContainer.appendChild(alert);
  
  // הסרה אוטומטית אחרי 5 שניות
  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => alert.remove(), 150);
  }, 5000);
}

// פונקציה לפירוק CSV
function parseCSVData(input) {
  // פיצול לשורות וסינון שורות ריקות
  const lines = input.split('\n')
    .map(line => line.trim())
    .filter(line => line);
  
  // הסרת שורת כותרת אם קיימת
  if (lines[0].toLowerCase().includes('תאריך') || 
      lines[0].toLowerCase().includes('date')) {
    lines.shift();
  }
  
  // קבלת המיפויים השמורים
  const categoryMappings = JSON.parse(localStorage.getItem('categoryMappings') || '{}');
  
  // המרת הנתונים למערך של אובייקטים
  const expenses = lines
    .map(line => {
      try {
        // פיצול השורה לשדות ונקיון תווים מיותרים
        const fields = line.split(',')
          .map(field => field.trim().replace(/^["']|["']$/g, ''));
        
        if (fields.length < 3) return null; // דילוג על שורות לא תקינות
        
        const [date, description, amount, category = '', notes = ''] = fields;
        if (!date || !description || !amount) return null;
        
        const trimmedDescription = description.trim();
        const parsedAmount = parseFloat(amount.replace(/[^\d.-]/g, ''));
        
        if (isNaN(parsedAmount)) return null;
        
        // שימוש בקטגוריה השמורה אם קיימת, אחרת שימוש בקטגוריה מה-CSV או 'אחר'
        const mappedCategory = categoryMappings[trimmedDescription];
        const finalCategory = mappedCategory || category.trim() || 'אחר';
        
        return {
          id: generateId(),
          date: formatDate(date),
          description: trimmedDescription,
          amount: parsedAmount,
          category: finalCategory,
          notes: notes.trim()
        };
      } catch (error) {
        console.error('שגיאה בעיבוד שורה:', line, error);
        return null;
      }
    })
    .filter(expense => expense !== null); // סינון שורות שגויות
  
  // בדיקה שיש הוצאות תקינות
  if (expenses.length === 0) {
    throw new Error('לא נמצאו הוצאות תקינות בטקסט שהוזן');
  }
  
  return expenses;
}

// פונקציה להסרת כפילויות
window.removeDuplicates = function() {
  const modal = bootstrap.Modal.getInstance(document.getElementById('duplicatesModal'));
  if (modal) {
    modal.hide();
  }
}

// פונקציות לגרפים
window.updateCharts = function() {
  const monthlyChartElement = document.getElementById('monthlyChart');
  const categoryChartElement = document.getElementById('categoryChart');
  
  if (monthlyChartElement && categoryChartElement) {
    updateMonthlyChart();
    updateCategoryChart();
  }
}

window.updateMonthlyChart = function() {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;

  const expenses = getFilteredExpenses();
  const monthlyData = {};
  
  // קיבוץ ההוצאות לפי חודשים
  expenses.forEach(expense => {
    const month = expense.date.substring(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = 0;
    }
    monthlyData[month] += expense.amount;
  });

  // הכנת הנתונים לגרף
  const sortedMonths = Object.keys(monthlyData).sort();
  const data = {
    labels: sortedMonths.map(month => {
      const [year, monthNum] = month.split('-');
      return `${getMonthName(parseInt(monthNum))} ${year}`;
    }),
    datasets: [{
      label: 'סה"כ הוצאות',
      data: sortedMonths.map(month => monthlyData[month]),
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };

  // הגדרות הגרף
  const config = {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatCurrency(value)
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => formatCurrency(context.raw)
          }
        }
      }
    }
  };

  // יצירת או עדכון הגרף
  if (window.charts.monthly instanceof Chart) {
    window.charts.monthly.destroy();
  }
  window.charts.monthly = new Chart(ctx, config);
}

window.updateCategoryChart = function() {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  const expenses = getFilteredExpenses();
  const categoryData = {};
  
  // קיבוץ ההוצאות לפי קטגוריות
  expenses.forEach(expense => {
    const category = expense.category || 'ללא קטגוריה';
    if (!categoryData[category]) {
      categoryData[category] = 0;
    }
    categoryData[category] += expense.amount;
  });

  // הכנת הנתונים לגרף
  const data = {
    labels: Object.keys(categoryData),
    datasets: [{
      data: Object.values(categoryData),
      backgroundColor: [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)',
        'rgba(255, 159, 64, 0.5)',
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)'
      ]
    }]
  };

  // הגדרות הגרף
  const config = {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: context => {
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
            }
          }
        }
      }
    }
  };

  // יצירת או עדכון הגרף
  if (window.charts.category instanceof Chart) {
    window.charts.category.destroy();
  }
  window.charts.category = new Chart(ctx, config);
}

// פונקציה לאיפוס כל הנתונים
window.clearAllData = function() {
  if (!confirm('האם אתה בטוח שברצונך למחוק את כל הנתונים? פעולה זו אינה הפיכה!')) {
    return;
  }
  
  // מחיקת כל הנתונים מה-localStorage
  localStorage.removeItem('expenses');
  
  // איפוס שדה הקלט
  document.getElementById('expenseInput').value = '';
  
  // איפוס הטבלה
  updateTable();
  
  // איפוס הגרפים
  updateCharts();
  
  alert('כל הנתונים נמחקו בהצלחה');
}

// פונקציה לעדכון קטגוריה
async function updateExpenseCategory(expenseId, newCategory) {
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  const expense = expenses.find(e => e.id === expenseId);
  
  if (!expense) return;

  // עדכון כל ההוצאות עם אותו שם
  const updatedExpenses = expenses.map(e => {
    if (e.description === expense.description) {
      return { ...e, category: newCategory };
    }
    return e;
  });
  
  // שמירת המיפוי החדש
  let categoryMappings = JSON.parse(localStorage.getItem('categoryMappings') || '{}');
  categoryMappings[expense.description] = newCategory;
  
  // שמירת השינויים
  localStorage.setItem('expenses', JSON.stringify(updatedExpenses));
  localStorage.setItem('categoryMappings', JSON.stringify(categoryMappings));
  
  // עדכון הטבלה
  updateTable();
}

// פונקציה לעדכון הטבלה
function updateTable() {
  const expensesContainer = document.getElementById('expensesContainer');
  expensesContainer.innerHTML = '';

  // השג את כל ההוצאות
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  if (expenses.length === 0) {
    expensesContainer.innerHTML = '<div class="alert alert-info">אין הוצאות להצגה</div>';
    return;
  }

  // קבל את הקטגוריה הנבחרת
  const selectedCategory = document.getElementById('categoryFilter').value;

  // סינון לפי קטגוריה אם נבחרה
  const filteredExpenses = selectedCategory ? 
    expenses.filter(expense => expense.category === selectedCategory) : 
    expenses;

  if (filteredExpenses.length === 0) {
    expensesContainer.innerHTML = '<div class="alert alert-info">לא נמצאו הוצאות בקטגוריה זו</div>';
    return;
  }

  // מיון לפי תאריך
  filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

  // קיבוץ הוצאות לפי חודש
  const expensesByMonth = {};
  filteredExpenses.forEach(expense => {
    const date = new Date(expense.date);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    if (!expensesByMonth[monthYear]) {
      expensesByMonth[monthYear] = [];
    }
    expensesByMonth[monthYear].push(expense);
  });

  // יצירת טבלה לכל חודש
  Object.entries(expensesByMonth)
    .sort((a, b) => {
      const [monthA, yearA] = a[0].split('/');
      const [monthB, yearB] = b[0].split('/');
      return yearB - yearA || monthB - monthA;
    })
    .forEach(([monthYear, monthExpenses]) => {
      const monthTable = createMonthlyTable(monthExpenses, monthYear);
      expensesContainer.appendChild(monthTable);
    });

  // עדכון הגרפים
  updateCharts();
}

// פונקציה ליצירת טבלה חודשית
function createMonthlyTable(expenses, monthYear) {
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-responsive mb-4';

  const monthHeader = document.createElement('h4');
  monthHeader.className = 'mb-3';
  const [month, year] = monthYear.split('/');
  monthHeader.textContent = `${getMonthName(parseInt(month))} ${year}`;
  tableWrapper.appendChild(monthHeader);

  const table = document.createElement('table');
  table.className = 'table table-striped table-hover';
  table.dataset.monthYear = monthYear;

  // יצירת כותרת הטבלה
  const thead = document.createElement('thead');
  thead.className = 'table-dark';
  thead.innerHTML = `
    <tr>
      <th class="sortable" onclick="sortTable(this, 'date')">תאריך <i class="bi bi-arrow-down-up"></i></th>
      <th class="sortable" onclick="sortTable(this, 'description')">תיאור <i class="bi bi-arrow-down-up"></i></th>
      <th class="sortable text-end" onclick="sortTable(this, 'amount')">סכום <i class="bi bi-arrow-down-up"></i></th>
      <th class="sortable" onclick="sortTable(this, 'category')">קטגוריה <i class="bi bi-arrow-down-up"></i></th>
      <th>הערות</th>
      <th>פעולות</th>
    </tr>
    <tr class="filter-row">
      <th><input type="text" onkeyup="filterTable(this)" data-column="date" placeholder="סנן תאריך..."></th>
      <th><input type="text" onkeyup="filterTable(this)" data-column="description" placeholder="סנן תיאור..."></th>
      <th><input type="text" onkeyup="filterTable(this)" data-column="amount" placeholder="סנן סכום..."></th>
      <th><input type="text" onkeyup="filterTable(this)" data-column="category" placeholder="סנן קטגוריה..."></th>
      <th><input type="text" onkeyup="filterTable(this)" data-column="notes" placeholder="סנן הערות..."></th>
      <th></th>
    </tr>
  `;

  const tbody = document.createElement('tbody');
  let monthlyTotal = 0;

  expenses.forEach(expense => {
    const row = document.createElement('tr');
    monthlyTotal += parseFloat(expense.amount);

    row.innerHTML = `
      <td>${expense.date}</td>
      <td>${expense.description}</td>
      <td class="text-end">${formatCurrency(expense.amount)}</td>
      <td class="category-cell" ondblclick="makeEditable(this, '${expense.id}')">${expense.category}</td>
      <td>${expense.notes || ''}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteExpense('${expense.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // שורת סיכום
  const tfoot = document.createElement('tfoot');
  tfoot.innerHTML = `
    <tr class="table-dark">
      <td colspan="2"><strong>סה"כ לחודש</strong></td>
      <td class="text-end"><strong>${formatCurrency(monthlyTotal)}</strong></td>
      <td colspan="3"></td>
    </tr>
  `;

  table.appendChild(thead);
  table.appendChild(tbody);
  table.appendChild(tfoot);
  tableWrapper.appendChild(table);

  return tableWrapper;
}

// פונקציה לסינון לפי קטגוריה
window.filterByCategory = function() {
  const selectedCategory = document.getElementById('categoryFilter').value;
  
  // עדכון הטבלה
  updateTable();
  
  // עדכון סטטיסטיקות רק אם יש קטגוריה נבחרת
  const statsDiv = document.getElementById('categoryStats');
  if (statsDiv) {
    if (selectedCategory) {
      const expenses = getFilteredExpenses();
      const categoryExpenses = expenses.filter(exp => exp.category === selectedCategory);
      
      // חישוב סטטיסטיקות
      const totalAmount = categoryExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      const monthlyData = {};
      
      categoryExpenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + parseFloat(expense.amount);
      });
      
      // יצירת HTML עם הסטטיסטיקות
      let html = `
        <div class="card bg-light">
          <div class="card-body">
            <h5 class="card-title">סטטיסטיקות עבור ${selectedCategory}</h5>
            <div class="row">
              <div class="col-md-6">
                <p class="mb-2">סה"כ הוצאות: ${formatCurrency(totalAmount)}</p>
              </div>
              <div class="col-md-6">
                <h6 class="mb-2">פירוט חודשי:</h6>
                <ul class="list-unstyled">
                  ${Object.entries(monthlyData)
                    .sort((a, b) => {
                      const [monthA, yearA] = a[0].split('/');
                      const [monthB, yearB] = b[0].split('/');
                      return new Date(yearB, monthB - 1) - new Date(yearA, monthA - 1);
                    })
                    .map(([month, amount]) => `
                      <li class="mb-1">
                        <small>${getMonthName(month.split('/')[0])} ${month.split('/')[1]}</small>: 
                        ${formatCurrency(amount)}
                      </li>
                    `).join('')}
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;
      
      statsDiv.innerHTML = html;
    } else {
      statsDiv.innerHTML = ''; // ניקוי הסטטיסטיקות כשאין קטגוריה נבחרת
    }
  }
  
  // עדכון הגרפים
  updateCharts();
}

// פונקציה לעדכון סטטיסטיקות של הקטגוריה
function updateCategoryStats() {
  const statsDiv = document.getElementById('categoryStats');
  const selectedCategory = document.getElementById('categoryFilter').value;
  
  if (!selectedCategory) {
    statsDiv.innerHTML = '';
    return;
  }
  
  const expenses = getFilteredExpenses();
  
  // חישוב סטטיסטיקות
  const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const monthlyData = {};
  
  expenses.forEach(expense => {
    const [day, month, year] = expense.date.split('/');
    const monthKey = `${month}/${year}`;
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + parseFloat(expense.amount);
  });
  
  // יצירת HTML עם הסטטיסטיקות
  let html = `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">סטטיסטיקות עבור ${selectedCategory}</h5>
        <p>סה"כ הוצאות: ₪${totalAmount.toFixed(2)}</p>
        <div class="row">
          <div class="col">
            <h6>פירוט חודשי:</h6>
            <ul class="list-unstyled">
              ${Object.entries(monthlyData)
                .sort((a, b) => {
                  const [monthA, yearA] = a[0].split('/');
                  const [monthB, yearB] = b[0].split('/');
                  return new Date(yearB, monthB - 1) - new Date(yearA, monthA - 1);
                })
                .map(([month, amount]) => `
                  <li>${month}: ₪${amount.toFixed(2)}</li>
                `).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
  
  statsDiv.innerHTML = html;
}

// פונקציה לעריכת קטגוריה
function editCategory(expenseId) {
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  const expense = expenses.find(e => e.id === expenseId);
  
  if (!expense) return;

  const categories = getAllCategories();
  
  // יצירת תיבת דו-שיח לבחירת קטגוריה
  const dialog = document.createElement('div');
  dialog.className = 'modal fade';
  dialog.id = 'editCategoryModal';
  dialog.setAttribute('tabindex', '-1');
  
  dialog.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">עריכת קטגוריה</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <p>בחר קטגוריה חדשה עבור "${expense.description}":</p>
          <div class="mb-3">
            <select id="newCategory" class="form-select">
              ${categories.map(cat => `
                <option value="${cat}" ${cat === expense.category ? 'selected' : ''}>
                  ${cat}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-check mb-3">
            <input type="checkbox" class="form-check-input" id="updateAll" checked>
            <label class="form-check-label" for="updateAll">
              עדכן את כל ההוצאות עם השם "${expense.description}"
            </label>
          </div>
          <div class="form-check mb-3">
            <input type="checkbox" class="form-check-input" id="rememberChoice">
            <label class="form-check-label" for="rememberChoice">
              זכור את הבחירה הזו להוצאות עתידיות
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">ביטול</button>
          <button type="button" class="btn btn-primary" onclick="updateCategory('${expenseId}')">עדכן</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  const modal = new bootstrap.Modal(dialog);
  modal.show();
  
  // הסרת המודל כשהוא נסגר
  dialog.addEventListener('hidden.bs.modal', () => {
    dialog.remove();
  });
}

// פונקציה לעדכון הקטגוריה
function updateCategory(expenseId) {
  const newCategory = document.getElementById('newCategory').value;
  const updateAll = document.getElementById('updateAll').checked;
  const rememberChoice = document.getElementById('rememberChoice').checked;
  
  let expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  const expense = expenses.find(e => e.id === expenseId);
  
  if (!expense) return;

  if (updateAll) {
    // עדכון כל ההוצאות עם אותו שם
    expenses = expenses.map(e => {
      if (e.description === expense.description) {
        return { ...e, category: newCategory };
      }
      return e;
    });
  } else {
    // עדכון רק ההוצאה הנוכחית
    expenses = expenses.map(e => {
      if (e.id === expenseId) {
        return { ...e, category: newCategory };
      }
      return e;
    });
  }
  
  // שמירת הבחירה להוצאות עתידיות
  if (rememberChoice) {
    let categoryMappings = JSON.parse(localStorage.getItem('categoryMappings') || '{}');
    categoryMappings[expense.description] = newCategory;
    localStorage.setItem('categoryMappings', JSON.stringify(categoryMappings));
  }
  
  localStorage.setItem('expenses', JSON.stringify(expenses));
  
  // סגירת המודל
  const modal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
  modal.hide();
  
  // עדכון הטבלה
  updateTable();
}

// פונקציה לעדכון רשימת הקטגוריות בפילטר
window.updateCategoryFilter = function() {
  const filter = document.getElementById('categoryFilter');
  const currentValue = filter.value;
  
  // קבלת כל ההוצאות
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  
  // קבלת קטגוריות ייחודיות שיש להן הוצאות
  const categories = [...new Set(expenses.map(expense => expense.category))]
    .filter(category => category) // סינון ערכים ריקים
    .sort((a, b) => a.localeCompare(b, 'he')); // מיון לפי א-ב בעברית
  
  // ניקוי ועדכון הרשימה
  filter.innerHTML = '<option value="">כל הקטגוריות</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    if (category === currentValue) {
      option.selected = true;
    }
    filter.appendChild(option);
  });
}

// פונקציה לייצוא לאקסל
window.exportToExcel = async function() {
  try {
    // טעינת הספרייה
    if (typeof XLSX === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js');
    }
    
    const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
    if (expenses.length === 0) {
      alert('אין נתונים לייצוא');
      return;
    }
    
    // ארגון הנתונים
    const data = [
      // כותרות
      ['תאריך', 'תיאור', 'סכום', 'קטגוריה', 'הערות']
    ];
    
    // מיון לפי תאריך
    expenses.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // הוספת הנתונים
    expenses.forEach(expense => {
      data.push([
        formatDateForExcel(expense.date),
        expense.description,
        expense.amount,
        expense.category,
        expense.notes || ''
      ]);
    });
    
    // יצירת גיליון עבודה
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // הגדרת רוחב עמודות
    const wscols = [
      {wch: 12}, // תאריך
      {wch: 30}, // תיאור
      {wch: 12}, // סכום
      {wch: 15}, // קטגוריה
      {wch: 30}  // הערות
    ];
    ws['!cols'] = wscols;
    
    // עיצוב תאים
    for (let i = 0; i < data.length; i++) {
      // עיצוב כותרות
      if (i === 0) {
        for (let j = 0; j < data[i].length; j++) {
          const cellRef = XLSX.utils.encode_cell({r: i, c: j});
          ws[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "CCCCCC" } },
            alignment: { horizontal: "center" }
          };
        }
      } else {
        // עיצוב סכומים
        const amountCell = XLSX.utils.encode_cell({r: i, c: 2});
        ws[amountCell].z = '#,##0.00₪';
        
        // עיצוב תאריכים
        const dateCell = XLSX.utils.encode_cell({r: i, c: 0});
        ws[dateCell].z = 'dd/mm/yyyy';
      }
    }
    
    // יצירת חוברת עבודה
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'הוצאות');
    
    // שמירת הקובץ
    const fileName = `הוצאות_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
  } catch (error) {
    console.error('שגיאה בייצוא לאקסל:', error);
    alert('אירעה שגיאה בייצוא לאקסל');
  }
}

// פונקציה לייצוא ל-CSV
window.exportToCSV = function() {
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  if (expenses.length === 0) {
    alert('אין נתונים לייצוא');
    return;
  }
  
  try {
    // מיון לפי תאריך
    expenses.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // יצירת כותרות
    let csv = 'תאריך,תיאור,סכום,קטגוריה,הערות\n';
    
    // הוספת הנתונים
    expenses.forEach(expense => {
      const row = [
        formatDateForExcel(expense.date),
        escapeCsvField(expense.description),
        expense.amount.toString().replace('.', ','), // שימוש בפסיק במקום נקודה עשרונית
        escapeCsvField(expense.category),
        escapeCsvField(expense.notes || '')
      ];
      csv += row.join(',') + '\n';
    });
    
    // יצירת קובץ והורדה
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const fileName = `הוצאות_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
    
    if (window.navigator.msSaveOrOpenBlob) {
      // עבור IE
      window.navigator.msSaveBlob(blob, fileName);
    } else {
      // עבור שאר הדפדפנים
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('שגיאה בייצוא ל-CSV:', error);
    alert('אירעה שגיאה בייצוא ל-CSV');
  }
}

// פונקציות עזר
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// פונקציית עזר לפורמט תאריך לאקסל
function formatDateForExcel(dateStr) {
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

// פונקציית עזר לטיפול בתווים מיוחדים ב-CSV
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  field = field.toString();
  // אם יש פסיקים או גרשיים, עוטפים את השדה במירכאות כפולות
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// פונקציה למחיקת הוצאה
window.deleteExpense = function(expenseId) {
  if (!confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
    return;
  }
  
  let expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  expenses = expenses.filter(expense => expense.id !== expenseId);
  localStorage.setItem('expenses', JSON.stringify(expenses));
  
  updateTable();
  updateCategoryFilter();
  updateCharts();
}

// פונקציה למיון טבלה
function sortTable(header, column) {
  const table = header.closest('table');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const isAsc = header.classList.toggle('asc');

  rows.sort((a, b) => {
    let aVal = a.querySelector(`td:nth-child(${getColumnIndex(column) + 1})`).textContent;
    let bVal = b.querySelector(`td:nth-child(${getColumnIndex(column) + 1})`).textContent;

    if (column === 'amount') {
      aVal = parseFloat(aVal.replace(/[^\d.-]/g, ''));
      bVal = parseFloat(bVal.replace(/[^\d.-]/g, ''));
    } else if (column === 'date') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }

    if (aVal < bVal) return isAsc ? -1 : 1;
    if (aVal > bVal) return isAsc ? 1 : -1;
    return 0;
  });

  rows.forEach(row => tbody.appendChild(row));
}

// פונקציה למחיקת הוצאה
function deleteExpense(expenseId) {
  if (!confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
    return;
  }

  let expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  expenses = expenses.filter(expense => expense.id !== expenseId);
  localStorage.setItem('expenses', JSON.stringify(expenses));
  
  updateTable();
}

// פונקציה לקבלת שם החודש בעברית
function getMonthName(month) {
  const months = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  return months[month - 1];
}

// פונקציה לעיצוב מספר כמטבע
function formatCurrency(amount) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2
  }).format(amount);
}

// פונקציות לסינון וטיפול בנתונים
window.getFilteredExpenses = function() {
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  const selectedCategory = localStorage.getItem('selectedCategory');
  
  if (!selectedCategory) {
    return expenses;
  }
  
  return expenses.filter(expense => expense.category === selectedCategory);
}

window.groupExpensesByMonth = function(expenses) {
  const groups = {};
  expenses.forEach(expense => {
    if (!expense || !expense.date) return;
    const month = expense.date.substring(0, 7); // YYYY-MM
    if (!groups[month]) {
      groups[month] = [];
    }
    groups[month].push(expense);
  });
  return groups;
}

window.getMonthName = function(monthNum) {
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return months[monthNum - 1];
}

// פונקציה למציאת אינדקס העמודה
function getColumnIndex(column) {
  const columns = {
    'date': 0,
    'description': 1,
    'amount': 2,
    'category': 3,
    'notes': 4
  };
  return columns[column] || 0;
}

// פונקציה לסינון הטבלה
function filterTable(input) {
  const column = input.dataset.column;
  const value = input.value.toLowerCase();
  const table = input.closest('table');
  const rows = table.getElementsByTagName('tr');

  for (let i = 2; i < rows.length - 1; i++) {
    const row = rows[i];
    const cell = row.querySelector(`td:nth-child(${getColumnIndex(column) + 1})`);
    if (cell) {
      const text = cell.textContent.toLowerCase();
      row.style.display = text.includes(value) ? '' : 'none';
    }
  }

  // עדכון הסכום הכולל
  updateMonthlyTotal(table);
}

// פונקציה לעדכון הסכום החודשי
function updateMonthlyTotal(table) {
  const rows = table.getElementsByTagName('tr');
  let total = 0;

  for (let i = 2; i < rows.length - 1; i++) {
    const row = rows[i];
    if (row.style.display !== 'none') {
      const amountCell = row.querySelector('td:nth-child(3)');
      if (amountCell) {
        const amount = parseFloat(amountCell.textContent.replace(/[^\d.-]/g, ''));
        if (!isNaN(amount)) {
          total += amount;
        }
      }
    }
  }

  const totalRow = table.querySelector('tfoot tr td:nth-child(3)');
  if (totalRow) {
    totalRow.textContent = formatCurrency(total);
  }
}

// פונקציה לקבלת כל הקטגוריות הקיימות
function getAllCategories() {
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  const categories = new Set();
  
  // הוספת קטגוריות קבועות
  const defaultCategories = [
    'מזון',
    'קניות',
    'חשבונות',
    'בילויים',
    'תחבורה',
    'בריאות',
    'חינוך',
    'ביגוד',
    'מתנות',
    'כיבוד',
    'אחר'
  ];
  
  defaultCategories.forEach(cat => categories.add(cat));
  
  // הוספת קטגוריות מההוצאות הקיימות
  expenses.forEach(expense => {
    if (expense.category) {
      categories.add(expense.category);
    }
  });
  
  return Array.from(categories).sort();
}

// פונקציה להפיכת תא לעריך
function makeEditable(cell, expenseId) {
  const currentCategory = cell.textContent;
  
  // יצירת שדה קלט עם רשימת הצעות
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'position-relative';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control form-control-sm';
  input.value = currentCategory;
  input.setAttribute('list', 'categories-list');
  
  // יצירת רשימת הצעות
  const datalist = document.createElement('datalist');
  datalist.id = 'categories-list';
  
  // מילוי רשימת ההצעות
  const categories = getAllCategories();
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    datalist.appendChild(option);
  });
  
  inputWrapper.appendChild(input);
  inputWrapper.appendChild(datalist);
  
  // טיפול בלחיצה על Enter
  input.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newCategory = input.value.trim();
      
      if (newCategory) {
        await updateExpenseCategory(expenseId, newCategory);
      }
      
      cell.textContent = newCategory;
    }
  });
  
  // טיפול באובדן פוקוס
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement !== input) {
        cell.textContent = input.value || currentCategory;
      }
    }, 200);
  });
  
  cell.textContent = '';
  cell.appendChild(inputWrapper);
  input.focus();
  input.select(); // בחירת כל הטקסט
}

// פונקציה לגנרציה של איידי ייחודי
function generateId() {
  return Date.now() + Math.random().toString(36).substr(2, 9);
}

// פונקציות עזר
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // ניקוי התאריך מרווחים ותווים מיותרים
  dateStr = dateStr.trim().replace(/['"]/g, '');
  
  // בדיקה אם התאריך כבר בפורמט YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  // טיפול בפורמט DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    // וידוא שהשנה היא בת 4 ספרות
    const fullYear = year.length === 2 ? '20' + year : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // אם הפורמט לא מוכר, להחזיר את התאריך כמו שהוא
  return dateStr;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2
  }).format(amount);
}
