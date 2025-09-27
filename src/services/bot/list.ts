import { AvailableBot } from "../../schemas/bot.ts";
import { getRegisteredBots } from "./bot-executor.ts";

const getVolumeBot1ParameterSchema = (): Record<string, string> => {
  return {
    walletId: "number (wallet ID from database)",
    mintPublicKey: "string (44 character base58 encoded public key)",
    volumeAmountSol: "number (positive SOL amount for volume)",
    blocksToWaitBeforeSell: "number (non-negative blocks to wait)",
  };
};

const getExecutionParameterSchema = (): Record<string, string> => {
  return {
    repeatCount: "number (1-100, cycles to execute)",
    intervalSeconds: "number (0-3600, seconds between cycles)",
  };
};

export function listAvailableBots(): AvailableBot[] {
  const registeredBots = getRegisteredBots();
  const availableBots: AvailableBot[] = [];

  for (const botType of registeredBots) {
    switch (botType) {
      case "volume-bot-1":
        availableBots.push({
          type: "volume-bot-1",
          name: "Volume Bot 1",
          description:
            "Creates trading volume by executing buy and sell operations",
          parameters: {
            botParameters: getVolumeBot1ParameterSchema(),
            executionParameters: getExecutionParameterSchema(),
          },
        });
        break;
    }
  }

  return availableBots;
}
