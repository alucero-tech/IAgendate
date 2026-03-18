import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getRevenueMetrics } from '@/features/metrics/services/metrics-actions'
import { MetricsClient } from '@/features/metrics/components/metrics-client'
import { redirect } from 'next/navigation'

export default async function MetricasPage() {
  const professional = await getCurrentProfessional()
  if (!professional?.is_owner) redirect('/bella-donna/dashboard')

  const weekData = await getRevenueMetrics('week')

  return <MetricsClient initialData={weekData} />
}
