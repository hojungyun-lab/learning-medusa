import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261104011602 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "b2b_employee" drop constraint if exists "b2b_employee_email_unique";`);
    this.addSql(`alter table if exists "b2b_company" drop constraint if exists "b2b_company_business_number_unique";`);
    this.addSql(`create table if not exists "b2b_company" ("id" text not null, "name" text not null, "business_number" text not null, "status" text check ("status" in ('pending', 'approved', 'suspended')) not null default 'pending', "credit_limit" numeric not null default 10000000, "spent_amount" numeric not null default 0, "phone" text not null, "metadata" jsonb null, "raw_credit_limit" jsonb not null default '{"value":"10000000","precision":20}', "raw_spent_amount" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "b2b_company_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_b2b_company_business_number_unique" ON "b2b_company" ("business_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_b2b_company_deleted_at" ON "b2b_company" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "b2b_employee" ("id" text not null, "email" text not null, "role" text check ("role" in ('admin', 'buyer', 'viewer')) not null default 'buyer', "spending_limit" numeric not null default 1000000, "is_active" boolean not null default true, "company_id" text not null, "raw_spending_limit" jsonb not null default '{"value":"1000000","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "b2b_employee_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_b2b_employee_email_unique" ON "b2b_employee" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_b2b_employee_company_id" ON "b2b_employee" ("company_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_b2b_employee_deleted_at" ON "b2b_employee" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "b2b_employee" add constraint "b2b_employee_company_id_foreign" foreign key ("company_id") references "b2b_company" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "b2b_employee" drop constraint if exists "b2b_employee_company_id_foreign";`);

    this.addSql(`drop table if exists "b2b_company" cascade;`);

    this.addSql(`drop table if exists "b2b_employee" cascade;`);
  }

}
