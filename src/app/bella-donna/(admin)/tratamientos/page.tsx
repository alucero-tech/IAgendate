import { getCategories, getCategoriesSimple } from '@/features/treatments/services/treatment-actions'
import { TreatmentsClient } from '@/features/treatments/components/treatments-client'

export default async function TratamientosPage() {
  const categories = await getCategories()
  const categoriesSimple = await getCategoriesSimple()

  return <TreatmentsClient categories={categories} categoriesSimple={categoriesSimple} />
}
