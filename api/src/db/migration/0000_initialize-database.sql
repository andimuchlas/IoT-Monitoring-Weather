CREATE TYPE "public"."device_status" AS ENUM('provisioned', 'active', 'maintenance', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'operator', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."sensor_status" AS ENUM('active', 'maintenance', 'faulty', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."quality_flag" AS ENUM('good', 'out_of_range', 'sensor_error', 'uncalibrated', 'future_timestamp', 'duplicate');--> statement-breakpoint
CREATE TABLE "device_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"old_status" "device_status",
	"new_status" "device_status" NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"location_id" uuid,
	"api_key_hash" text NOT NULL,
	"status" "device_status" DEFAULT 'provisioned' NOT NULL,
	"firmware_version" varchar(50),
	"battery_v" double precision,
	"rssi" integer,
	"last_seen_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"altitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sensor_types" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"unit" varchar(30) NOT NULL,
	"min_val" double precision NOT NULL,
	"max_val" double precision NOT NULL,
	"precision" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"sensor_type_id" varchar(50) NOT NULL,
	"status" "sensor_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sensors_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "sensor_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"sensor_id" uuid NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensor_calibrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sensor_id" uuid NOT NULL,
	"scale" double precision DEFAULT 1 NOT NULL,
	"offset" double precision DEFAULT 0 NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensor_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"sensor_id" uuid NOT NULL,
	"sensor_type_id" varchar(50) NOT NULL,
	"raw_value" double precision NOT NULL,
	"value" double precision NOT NULL,
	"quality_flag" "quality_flag" DEFAULT 'good' NOT NULL,
	"server_time" timestamp with time zone DEFAULT now() NOT NULL,
	"seq" integer
);
--> statement-breakpoint
CREATE TABLE "reading_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" timestamp with time zone NOT NULL,
	"interval" varchar(10) NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"sensor_id" uuid NOT NULL,
	"sensor_type_id" varchar(50) NOT NULL,
	"avg_value" double precision,
	"min_value" double precision,
	"max_value" double precision,
	"sum_value" double precision,
	"reading_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_status_history" ADD CONSTRAINT "device_status_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_status_history" ADD CONSTRAINT "device_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_sensor_type_id_sensor_types_id_fk" FOREIGN KEY ("sensor_type_id") REFERENCES "public"."sensor_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_installations" ADD CONSTRAINT "sensor_installations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_installations" ADD CONSTRAINT "sensor_installations_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_calibrations" ADD CONSTRAINT "sensor_calibrations_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensor_type_id_sensor_types_id_fk" FOREIGN KEY ("sensor_type_id") REFERENCES "public"."sensor_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_aggregates" ADD CONSTRAINT "reading_aggregates_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_aggregates" ADD CONSTRAINT "reading_aggregates_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_aggregates" ADD CONSTRAINT "reading_aggregates_sensor_type_id_sensor_types_id_fk" FOREIGN KEY ("sensor_type_id") REFERENCES "public"."sensor_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sensor_installations_device_idx" ON "sensor_installations" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "sensor_installations_sensor_idx" ON "sensor_installations" USING btree ("sensor_id");--> statement-breakpoint
CREATE INDEX "sensor_installations_active_idx" ON "sensor_installations" USING btree ("device_id","uninstalled_at");--> statement-breakpoint
CREATE INDEX "sensor_calibrations_lookup_idx" ON "sensor_calibrations" USING btree ("sensor_id","effective_from" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "sensor_readings_idempotency_idx" ON "sensor_readings" USING btree ("device_id","sensor_id","time");--> statement-breakpoint
CREATE INDEX "sensor_readings_sensor_time_idx" ON "sensor_readings" USING btree ("sensor_id","time" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensor_readings_device_time_idx" ON "sensor_readings" USING btree ("device_id","time" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensor_readings_device_type_time_idx" ON "sensor_readings" USING btree ("device_id","sensor_type_id","time" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "reading_aggregates_unique_idx" ON "reading_aggregates" USING btree ("device_id","sensor_id","bucket","interval");--> statement-breakpoint
CREATE INDEX "reading_aggregates_query_idx" ON "reading_aggregates" USING btree ("device_id","sensor_type_id","interval","bucket" DESC NULLS LAST);