CREATE TYPE "public"."weather_day_kind" AS ENUM('observed', 'forecast');--> statement-breakpoint
CREATE TABLE "weather_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"weather_fetch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "weather_day_kind" NOT NULL,
	"precipitation_mm" numeric(8, 3) NOT NULL,
	"temperature_min_c" numeric(6, 2) NOT NULL,
	"temperature_max_c" numeric(6, 2) NOT NULL,
	"et0_mm" numeric(8, 3) NOT NULL,
	"wind_speed_max_kph" numeric(7, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weather_day_temperature_order" CHECK ("weather_day"."temperature_max_c" >= "weather_day"."temperature_min_c"),
	CONSTRAINT "weather_day_nonnegative_measurements" CHECK ("weather_day"."precipitation_mm" >= 0 and "weather_day"."et0_mm" >= 0 and "weather_day"."wind_speed_max_kph" >= 0)
);
--> statement-breakpoint
CREATE TABLE "weather_fetch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"request_url" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_response" jsonb,
	"success" boolean NOT NULL,
	"error" text,
	CONSTRAINT "weather_fetch_result" CHECK (("weather_fetch"."success" and "weather_fetch"."raw_response" is not null and "weather_fetch"."error" is null)
        or (not "weather_fetch"."success" and "weather_fetch"."error" is not null))
);
--> statement-breakpoint
ALTER TABLE "weather_day" ADD CONSTRAINT "weather_day_garden_id_garden_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."garden"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_day" ADD CONSTRAINT "weather_day_weather_fetch_id_weather_fetch_id_fk" FOREIGN KEY ("weather_fetch_id") REFERENCES "public"."weather_fetch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_fetch" ADD CONSTRAINT "weather_fetch_garden_id_garden_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."garden"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weather_day_garden_date_kind_idx" ON "weather_day" USING btree ("garden_id","date","kind");--> statement-breakpoint
CREATE INDEX "weather_day_garden_date_idx" ON "weather_day" USING btree ("garden_id","date");--> statement-breakpoint
CREATE INDEX "weather_fetch_garden_fetched_idx" ON "weather_fetch" USING btree ("garden_id","fetched_at");