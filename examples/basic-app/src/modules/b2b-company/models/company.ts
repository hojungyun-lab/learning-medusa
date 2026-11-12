import { model } from "@medusajs/framework/utils"

export const Company = model.define("b2b_company", {
  id: model.id({ prefix: "comp" }).primaryKey(),
  name: model.text().searchable(),
  business_number: model.text().unique(),
  status: model.enum(["pending", "approved", "suspended"]).default("pending"),
  credit_limit: model.bigNumber().default(10000000),
  spent_amount: model.bigNumber().default(0),
  phone: model.text(),
  metadata: model.json().nullable(),
  employees: model.hasMany(() => CompanyEmployee, {
    mappedBy: "company",
  }),
})

export const CompanyEmployee = model.define("b2b_employee", {
  id: model.id({ prefix: "comp_emp" }).primaryKey(),
  email: model.text().unique(),
  role: model.enum(["admin", "buyer", "viewer"]).default("buyer"),
  spending_limit: model.bigNumber().default(1000000),
  is_active: model.boolean().default(true),
  company: model.belongsTo(() => Company, {
    mappedBy: "employees",
  }),
})

