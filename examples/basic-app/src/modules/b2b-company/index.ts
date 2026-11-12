import { Module } from "@medusajs/framework/utils"
import B2BCompanyModuleService from "./service"

export const B2B_COMPANY_MODULE = "b2bCompanyModuleService"

export default Module(B2B_COMPANY_MODULE, {
  service: B2BCompanyModuleService,
})

