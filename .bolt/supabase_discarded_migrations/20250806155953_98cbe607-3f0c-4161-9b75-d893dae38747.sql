-- Add crypto wallet addresses to bot_content if not exists
INSERT INTO bot_content (content_key, content_value, description, content_type) VALUES
('crypto_btc_address', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'Bitcoin wallet address for payments', 'wallet_address'),
('crypto_eth_address', '0x742d35Cc6642C4532F35B35D00a8e0c8dC2dA4cB', 'Ethereum wallet address for payments', 'wallet_address'),
('crypto_usdt_trc20', 'TLPjmhVJ8xJDrA36BNhSj1kFnV2kdEKdWs', 'USDT TRC20 wallet address for payments', 'wallet_address'),
('crypto_usdt_erc20', '0x742d35Cc6642C4532F35B35D00a8e0c8dC2dA4cB', 'USDT ERC20 wallet address for payments', 'wallet_address')
ON CONFLICT (content_key) DO UPDATE SET
content_value = EXCLUDED.content_value,
updated_at = now();