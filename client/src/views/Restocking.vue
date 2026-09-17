<template>
  <div class="restocking">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">{{ t('restocking.budgetLabel') }}</h3>
        <span class="budget-value">{{ formatCurrency(budget) }}</span>
      </div>
      <input
        type="range"
        min="0"
        max="500000"
        step="5000"
        v-model.number="budget"
        @input="handleBudgetInput"
        @change="loadRecommendations"
        class="budget-slider"
      />
      <div class="budget-range-labels">
        <span>{{ formatCurrency(0) }}</span>
        <span>{{ formatCurrency(500000) }}</span>
      </div>
      <p class="budget-help">{{ t('restocking.budgetHelp') }}</p>
    </div>

    <div v-if="placedOrder" class="banner success">
      {{ t('restocking.orderPlaced', { orderNumber: placedOrder.order_number }) }}
    </div>
    <div v-if="placeError" class="banner danger">{{ placeError }}</div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div class="stats-grid">
        <div class="stat-card info">
          <div class="stat-label">{{ t('restocking.summary.itemCount') }}</div>
          <div class="stat-value">{{ recommendations.length }}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">{{ t('restocking.summary.totalCost') }}</div>
          <div class="stat-value">{{ formatCurrency(totalCost) }}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">{{ t('restocking.summary.budgetRemaining') }}</div>
          <div class="stat-value">{{ formatCurrency(budgetRemaining) }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('restocking.recommendedItems') }}</h3>
          <button
            class="place-order-btn"
            :disabled="recommendations.length === 0 || loading || placing"
            @click="placeOrder"
          >
            {{ placing ? t('restocking.placing') : t('restocking.placeOrder') }}
          </button>
        </div>

        <div v-if="recommendations.length === 0" class="no-data">
          {{ t('restocking.noRecommendations') }}
        </div>
        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('restocking.table.item') }}</th>
                <th>{{ t('restocking.table.category') }}</th>
                <th>{{ t('restocking.table.trend') }}</th>
                <th>{{ t('restocking.table.currentDemand') }}</th>
                <th>{{ t('restocking.table.forecastedDemand') }}</th>
                <th>{{ t('restocking.table.demandGap') }}</th>
                <th>{{ t('restocking.table.unitCost') }}</th>
                <th>{{ t('restocking.table.quantity') }}</th>
                <th>{{ t('restocking.table.itemCost') }}</th>
                <th>{{ t('restocking.table.leadTime') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recommendations" :key="item.sku">
                <td><strong>{{ item.name }}</strong><br /><span class="sku">{{ item.sku }}</span></td>
                <td>{{ item.category }}</td>
                <td><span :class="['badge', item.trend]">{{ item.trend }}</span></td>
                <td>{{ item.current_demand }}</td>
                <td>{{ item.forecasted_demand }}</td>
                <td>{{ item.demand_gap }}</td>
                <td>{{ formatCurrency(item.unit_cost) }}</td>
                <td>{{ item.recommended_quantity }}</td>
                <td><strong>{{ formatCurrency(item.item_total_cost) }}</strong></td>
                <td>{{ t('restocking.table.days', { count: item.lead_time_days }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'
import { useRestockingBudget } from '../composables/useRestockingBudget'
import { formatCurrency as formatCurrencyUtil } from '../utils/currency'

export default {
  name: 'Restocking',
  setup() {
    const { t, currentCurrency } = useI18n()
    const { budget } = useRestockingBudget()

    const loading = ref(true)
    const error = ref(null)
    const recommendations = ref([])
    const totalCost = ref(0)
    const budgetRemaining = ref(0)
    const placing = ref(false)
    const placedOrder = ref(null)
    const placeError = ref(null)

    const formatCurrency = (value) => formatCurrencyUtil(value, currentCurrency.value)

    const handleBudgetInput = () => {
      placedOrder.value = null
      placeError.value = null
    }

    const loadRecommendations = async () => {
      try {
        loading.value = true
        error.value = null
        recommendations.value = []
        totalCost.value = 0
        budgetRemaining.value = 0
        const data = await api.getRestockingRecommendations(budget.value)
        recommendations.value = data.items
        totalCost.value = data.total_cost
        budgetRemaining.value = data.budget_remaining
      } catch (err) {
        error.value = 'Failed to load restocking recommendations: ' + err.message
      } finally {
        loading.value = false
      }
    }

    const placeOrder = async () => {
      if (recommendations.value.length === 0) return
      try {
        placing.value = true
        placeError.value = null
        const orderPayload = {
          budget: budget.value,
          items: recommendations.value.map(item => ({
            sku: item.sku,
            name: item.name,
            category: item.category,
            quantity: item.recommended_quantity,
            unit_cost: item.unit_cost,
            lead_time_days: item.lead_time_days
          }))
        }
        const order = await api.createRestockingOrder(orderPayload)
        placedOrder.value = order
        budget.value = Math.max(0, Math.round((budget.value - order.total_cost) / 5000) * 5000)
        await loadRecommendations()
      } catch (err) {
        placeError.value = 'Failed to place order: ' + err.message
      } finally {
        placing.value = false
      }
    }

    onMounted(loadRecommendations)

    return {
      t,
      budget,
      loading,
      error,
      recommendations,
      totalCost,
      budgetRemaining,
      placing,
      placedOrder,
      placeError,
      formatCurrency,
      handleBudgetInput,
      loadRecommendations,
      placeOrder
    }
  }
}
</script>

<style scoped>
.budget-slider {
  width: 100%;
  accent-color: #2563eb;
  margin: 0.75rem 0 0.375rem;
}

.budget-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2563eb;
}

.budget-range-labels {
  display: flex;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 0.75rem;
}

.budget-help {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 0.75rem;
}

.sku {
  color: #64748b;
  font-size: 0.75rem;
}

.place-order-btn {
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1.125rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.place-order-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.place-order-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.banner {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1.25rem;
}

.banner.success {
  background: #d1fae5;
  color: #065f46;
}

.banner.danger {
  background: #fecaca;
  color: #991b1b;
}

.no-data {
  color: #64748b;
  font-size: 0.875rem;
  padding: 1rem 0;
}
</style>
