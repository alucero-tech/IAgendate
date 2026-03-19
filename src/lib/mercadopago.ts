import { MercadoPagoConfig, Preference, Payment, PreApproval, PreApprovalPlan } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
})

export const preferenceClient = new Preference(client)
export const paymentClient = new Payment(client)
export const preApprovalClient = new PreApproval(client)
export const preApprovalPlanClient = new PreApprovalPlan(client)
