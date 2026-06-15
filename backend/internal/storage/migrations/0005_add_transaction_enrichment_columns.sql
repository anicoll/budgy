-- +goose Up
ALTER TABLE transactions ADD COLUMN merchant_website TEXT;
ALTER TABLE transactions ADD COLUMN merchant_logo_url TEXT;
ALTER TABLE transactions ADD COLUMN location_address TEXT;
ALTER TABLE transactions ADD COLUMN location_lat TEXT;
ALTER TABLE transactions ADD COLUMN location_lng TEXT;
ALTER TABLE transactions ADD COLUMN category_code TEXT;
ALTER TABLE transactions ADD COLUMN category_title TEXT;

-- +goose Down
ALTER TABLE transactions DROP COLUMN IF EXISTS merchant_website;
ALTER TABLE transactions DROP COLUMN IF EXISTS merchant_logo_url;
ALTER TABLE transactions DROP COLUMN IF EXISTS location_address;
ALTER TABLE transactions DROP COLUMN IF EXISTS location_lat;
ALTER TABLE transactions DROP COLUMN IF EXISTS location_lng;
ALTER TABLE transactions DROP COLUMN IF EXISTS category_code;
ALTER TABLE transactions DROP COLUMN IF EXISTS category_title;
