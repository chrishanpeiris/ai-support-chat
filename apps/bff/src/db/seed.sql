INSERT INTO products (name, description, price, stock, category) VALUES
  ('Laptop Pro 15',              'High-performance laptop with 15-inch display',             1299.99, 45,  'Electronics'),
  ('Wireless Mouse',             'Ergonomic wireless mouse with 12-month battery life',        49.99, 120, 'Accessories'),
  ('USB-C Hub',                  '7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader',   79.99, 80,  'Accessories'),
  ('Mechanical Keyboard',        'Tenkeyless mechanical keyboard with RGB backlighting',       149.99, 60, 'Accessories'),
  ('4K Monitor',                 '27-inch 4K IPS monitor with 144Hz refresh rate',            599.99, 30, 'Electronics'),
  ('Laptop Stand',               'Adjustable aluminium laptop stand',                          39.99, 200,'Accessories'),
  ('Noise Cancelling Headphones','Over-ear headphones with ANC and 30-hour battery',          299.99, 55, 'Audio'),
  ('Webcam 4K',                  '4K USB webcam with built-in microphone',                    129.99, 40, 'Accessories')
ON CONFLICT DO NOTHING;
