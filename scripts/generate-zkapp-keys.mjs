import fs from "node:fs";
import path from "node:path";
import { PrivateKey } from "o1js";

import {
  ZEKO_GRAPHQL_NETWORK_ID,
  ZEKO_NETWORK_NAME,
  ZEKO_PROTOCOL_NETWORK_ID,
  ZEKO_SIGNING_NETWORK_ID
} from "../packages/protocol/zeko-network.js";

const outputDir =
  path.join(
    process.cwd(),
    "data",
    "keys"
  );

const roles = [
  {
    role: "deployer",
    kind: "mba-zeko-deployer-key-v1",
    filename:
      "deployer-zeko-sepolia-key.json"
  },
  {
    role: "missionRegistry",
    kind: "mba-mission-registry-zkapp-key-v1",
    filename:
      "mission-registry-zeko-sepolia-key.json"
  },
  {
    role: "missionAuthority",
    kind: "mba-mission-authority-pallas-key-v1",
    filename:
      "mission-authority-zeko-sepolia-key.json"
  }
];

fs.mkdirSync(
  outputDir,
  {
    recursive: true,
    mode: 0o700
  }
);

const keys =
  roles.map(
    ({
      role,
      kind,
      filename
    }) => {
      const outputPath =
        path.join(
          outputDir,
          filename
        );

      if (
        fs.existsSync(outputPath) &&
        process.env.FORCE !== "1"
      ) {
        const existing =
          JSON.parse(
            fs.readFileSync(
              outputPath,
              "utf8"
            )
          );

        return {
          role,
          reused: true,
          path:
            path.relative(
              process.cwd(),
              outputPath
            ),
          publicKey:
            existing.publicKey
        };
      }

      const privateKey =
        PrivateKey.random();

      const publicKey =
        privateKey
          .toPublicKey()
          .toBase58();

      const payload = {
        kind,

        network:
          ZEKO_NETWORK_NAME,

        protocolNetworkId:
          ZEKO_PROTOCOL_NETWORK_ID,

        graphqlNetworkId:
          ZEKO_GRAPHQL_NETWORK_ID,

        signingNetworkId:
          ZEKO_SIGNING_NETWORK_ID,

        publicKey,

        privateKey:
          privateKey.toBase58(),

        createdAt:
          new Date().toISOString()
      };

      fs.writeFileSync(
        outputPath,
        `${JSON.stringify(
          payload,
          null,
          2
        )}\n`,
        {
          mode: 0o600
        }
      );

      return {
        role,
        reused: false,

        path:
          path.relative(
            process.cwd(),
            outputPath
          ),

        publicKey
      };
    }
  );

console.log(
  JSON.stringify(
    {
      ok: true,
      warning:
        "Private keys saved locally under data/keys. Do not share these files.",
      keys
    },
    null,
    2
  )
);