# Citadel API

[![codecov](https://codecov.io/github/runcitadel/manager/branch/main/graph/badge.svg?token=9WJ88AUTB9)](https://codecov.io/github/runcitadel/manager)

This is the main backend of Citadel that handles:

- User authentication using JWT
- Encryption/decryption of sensitive information, such as the lightning wallet's seed
- CRUD operations
- Lifecycle-management of all other containerized services
- Communication with Bitcoind and Electrs

## 🛠 Running api (for development purposes only)

### Step 1. Install dependencies
```sh
yarn
```

### Step 2. Set environment variables
Set the following environment variables directly or by placing them in `.env` file of project's root.

| Variable | Description | Default |
| ------------- | ------------- | ------------- |
| `PORT` | Port where manager should listen for requests | `3000` |
| `DEVICE_HOSTS` | Comma separated list of IPs or domain names to whitelist for CORS | `http://citadel.local` |
| `USER_FILE` | Path to the user's data file (automatically created on user registration) | `/db/user.json` |
| `MIDDLEWARE_API_URL` | IP or domain where [`middleware`](https://github.com/runcitadel/middleware) is listening | `http://localhost` |
| `MIDDLEWARE_API_PORT` | Port where [`middleware`](https://github.com/runcitadel/middleware) is listening | `3005` |
| `JWT_PUBLIC_KEY_FILE` | Path to the JWT public key (automatically created) | `/db/jwt-public-key/jwt.pem` |
| `JWT_PRIVATE_KEY_FILE` | Path to the JWT private key (automatically created) | `/db/jwt-public-key/jwt.key` |
| `JWT_EXPIRATION` | JWT expiration in miliseconds | `3600` |
| `SEED_FILE` | Path to the seed used to deterministically generate entropy | `'/db/citadel-seed/seed'` |
| `ELECTRUM_PORT` | Host the Electrum server is listening on | - |
| `ELECTRUM_PORT` | Port the Electrum server is listening on | `50001` |
| `BITCOIN_HOSTT` | Host where `bitcoind` is listening | - |
| `BITCOIN_P2P_PORT` | P2P port of `bitcoin` | `8333` |
| `BITCOIN_RPC_PORT` | RPC port of `bitcoin` | `8332` |
| `BITCOIN_RPC_USER` | RPC user for `bitcoin` | `citadel` |
| `BITCOIN_RPC_PASSWORD` | RPC password for `bitcoin` | `moneyprintergobrrr` |
| `GITHUB_REPO` | GitHub repository of Citadel | `runcitadel/compose-nonfree` |
| `VERSION_FILE` | Path to Citadel's version file | `/info.json` |
| `TOR_PROXY_IP` | IP or domain where Tor proxy is listening | `192.168.0.1` |
| `TOR_PROXY_PORT` | Port where Tor proxy is listening | `9050` |

### Step 3. Run manager
```sh
yarn start
```

You can browse through the available API endpoints [here](https://github.com/citadel-core/api/tree/main/routes/v2) or use [our TypeScript SDK](https://github.com/runcitadel/sdk-v2).

---

## 🙏 Acknowledgements

The Citadel API is inspired by and built upon the work done by [Umbrel](https://github.com/getumbrel) on its open-source [Manager API](https://github.com/getumbrel/umbrel-manager).

The original code we forked is licensed under

```
Copyright (c) 2018-2019 Casa, Inc. https://keys.casa/
Copyright (c) 2020 Umbrel. https://getumbrel.com/
```

---

[![License](https://img.shields.io/github/license/runcitadel/manager?color=%235351FB)](https://github.com/runcitadel/manager/blob/main/LICENSE)

