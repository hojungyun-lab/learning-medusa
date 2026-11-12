import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import B2BCompanyModule from "../modules/b2b-company"

export default defineLink(
  CustomerModule.linkable.customer,
  B2BCompanyModule.linkable.b2bCompany
)
