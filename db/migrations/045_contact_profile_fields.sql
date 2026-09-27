ALTER TABLE contacts ADD COLUMN country text CHECK (country IS NULL OR char_length(btrim(country)) BETWEEN 2 AND 100);
ALTER TABLE contacts ADD COLUMN city text CHECK (city IS NULL OR char_length(btrim(city)) BETWEEN 2 AND 100);
ALTER TABLE contacts ADD COLUMN bio text CHECK (bio IS NULL OR char_length(btrim(bio)) <= 5000);
ALTER TABLE contacts ADD COLUMN company text CHECK (company IS NULL OR char_length(btrim(company)) BETWEEN 1 AND 200);
