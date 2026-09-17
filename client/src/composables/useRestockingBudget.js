import { ref } from 'vue'

// Shared restocking budget state (singleton pattern, same as useFilters)
// Persists across the session and decreases as restocking orders are placed
const budget = ref(50000)

export function useRestockingBudget() {
  return {
    budget
  }
}
