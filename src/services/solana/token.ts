import * as connectionService from "./connection.ts";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import * as logging from "../../utils/logging.ts";

/**
 * Build SOL transfer instruction
 */
export function buildSolTransferIx(
  from: PublicKey,
  to: PublicKey,
  amountLamports: number | bigint,
): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: to,
    lamports: BigInt(amountLamports),
  });
}

/**
 * Build WSOL ATA creation instruction
 */
export async function buildCreateWsolAtaIx(
  owner: PublicKey,
  requestId = "system",
): Promise<TransactionInstruction | null> {
  const connection = await connectionService.getConnection();

  const ataAddress = await spl.getAssociatedTokenAddress(
    new PublicKey(spl.NATIVE_MINT),
    owner,
  );

  try {
    // Check if the ATA already exists
    await connection.getTokenAccountBalance(ataAddress);
    logging.debug(requestId, "WSOL ATA already exists", {
      owner: owner.toString(),
      ata: ataAddress.toString(),
    });
    return null; // ATA already exists
  } catch (_error) {
    // ATA doesn't exist, create it
    logging.debug(requestId, "Creating WSOL ATA instruction", {
      owner: owner.toString(),
      ata: ataAddress.toString(),
    });
    return spl.createAssociatedTokenAccountInstruction(
      owner, // Use owner as the payer
      ataAddress,
      owner,
      new PublicKey(spl.NATIVE_MINT),
    );
  }
}

/**
 * Build WSOL transfer instructions (wrap SOL + transfer)
 */
export async function buildWsolTransferIxs(
  from: PublicKey,
  to: PublicKey,
  amountLamports: number | bigint,
  requestId = "system",
): Promise<TransactionInstruction[]> {
  const connection = await connectionService.getConnection();
  const instructions: TransactionInstruction[] = [];

  // Get sender's WSOL ATA
  const fromAta = await spl.getAssociatedTokenAddress(
    new PublicKey(spl.NATIVE_MINT),
    from,
  );

  // Get recipient's WSOL ATA
  const toAta = await spl.getAssociatedTokenAddress(
    new PublicKey(spl.NATIVE_MINT),
    to,
  );

  logging.debug(requestId, "Building WSOL transfer instructions", {
    from: from.toString(),
    to: to.toString(),
    fromAta: fromAta.toString(),
    toAta: toAta.toString(),
    amountLamports: amountLamports.toString(),
  });

  // Check if sender's ATA exists
  try {
    await connection.getTokenAccountBalance(fromAta);
    logging.debug(requestId, "Sender WSOL ATA exists", {
      ata: fromAta.toString(),
    });
  } catch (_error) {
    // Create sender's ATA
    logging.debug(requestId, "Creating sender WSOL ATA", {
      ata: fromAta.toString(),
    });
    instructions.push(
      spl.createAssociatedTokenAccountInstruction(
        from, // Use from as the payer
        fromAta,
        from,
        new PublicKey(spl.NATIVE_MINT),
      ),
    );
  }

  // Check if recipient's ATA exists
  try {
    await connection.getTokenAccountBalance(toAta);
    logging.debug(requestId, "Recipient WSOL ATA exists", {
      ata: toAta.toString(),
    });
  } catch (_error) {
    // Create recipient's ATA
    logging.debug(requestId, "Creating recipient WSOL ATA", {
      ata: toAta.toString(),
    });
    instructions.push(
      spl.createAssociatedTokenAccountInstruction(
        from, // Use from as the payer
        toAta,
        to,
        new PublicKey(spl.NATIVE_MINT),
      ),
    );
  }

  // Transfer SOL to WSOL account (wrap)
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: fromAta,
      lamports: BigInt(amountLamports),
    }),
  );

  // Sync native instruction to update the token balance
  instructions.push(spl.createSyncNativeInstruction(fromAta));

  // Transfer WSOL from sender to recipient
  instructions.push(
    spl.createTransferInstruction(
      fromAta,
      toAta,
      from,
      BigInt(amountLamports),
    ),
  );

  return instructions;
}

/**
 * Build WSOL reclaim instructions (close ATA + transfer remaining SOL)
 */
export async function buildReclaimWsolIxs(
  from: Keypair,
  to: PublicKey,
  requestId = "system",
): Promise<TransactionInstruction[]> {
  const connection = await connectionService.getConnection();
  const instructions: TransactionInstruction[] = [];

  // Get WSOL ATA address
  const ataAddress = await spl.getAssociatedTokenAddress(
    new PublicKey(spl.NATIVE_MINT),
    from.publicKey,
  );

  logging.debug(requestId, "Building WSOL reclaim instructions", {
    from: from.publicKey.toString(),
    to: to.toString(),
    ata: ataAddress.toString(),
  });

  try {
    // Check if the ATA exists
    await connection.getTokenAccountBalance(ataAddress);

    logging.debug(requestId, "WSOL ATA exists, creating close instruction", {
      ata: ataAddress.toString(),
    });

    // Close the ATA account, sending remaining SOL to the destination
    instructions.push(
      spl.createCloseAccountInstruction(
        ataAddress,
        to,
        from.publicKey,
      ),
    );
  } catch (_error) {
    // ATA doesn't exist, nothing to reclaim
    logging.debug(
      requestId,
      "WSOL ATA does not exist, no close instruction needed",
      {
        ata: ataAddress.toString(),
      },
    );
  }

  // Get SOL balance
  const balance = await connection.getBalance(from.publicKey);

  if (balance > 5000) { // Leave 5000 lamports for tx fee
    // Transfer remaining SOL
    logging.debug(requestId, "Adding SOL transfer instruction", {
      from: from.publicKey.toString(),
      to: to.toString(),
      balance,
      transferAmount: balance - 5000,
    });

    instructions.push(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports: BigInt(balance - 5000),
      }),
    );
  } else {
    logging.debug(requestId, "Insufficient SOL balance for transfer", {
      from: from.publicKey.toString(),
      balance,
    });
  }

  return instructions;
}

/**
 * Get WSOL mint address
 */
export function getWsolMintAddress(): PublicKey {
  return new PublicKey(spl.NATIVE_MINT);
}

/**
 * Find associated token address for a wallet
 */
export async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey,
): Promise<PublicKey> {
  return await spl.getAssociatedTokenAddress(
    tokenMintAddress,
    walletAddress,
  );
}

/**
 * Send and confirm a transaction
 */
export async function sendAndConfirmTransaction(
  transaction: Transaction,
  signers: Keypair[],
  requestId = "system",
): Promise<string> {
  const connection = await connectionService.getConnection();

  // Sign transaction
  transaction.feePayer = signers[0].publicKey;
  transaction.recentBlockhash =
    (await connection.getLatestBlockhash()).blockhash;
  transaction.sign(...signers);

  logging.debug(requestId, "Sending transaction", {
    signers: signers.map((s) => s.publicKey.toString()),
    instructionCount: transaction.instructions.length,
  });

  // Send transaction
  const rawTransaction = transaction.serialize();
  const signature = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  logging.info(requestId, "Transaction sent", { signature });

  // Confirm transaction
  const confirmation = await connection.confirmTransaction(signature);
  if (confirmation.value.err) {
    const error = typeof confirmation.value.err === "string"
      ? confirmation.value.err
      : JSON.stringify(confirmation.value.err);

    logging.error(requestId, `Transaction failed: ${error}`, { signature });
    throw new Error(`Transaction failed: ${error}`);
  }

  logging.info(requestId, "Transaction confirmed", {
    signature,
    slot: confirmation.context.slot,
  });

  return signature;
}

export default {
  buildSolTransferIx,
  buildCreateWsolAtaIx,
  buildWsolTransferIxs,
  buildReclaimWsolIxs,
  getWsolMintAddress,
  findAssociatedTokenAddress,
  sendAndConfirmTransaction,
};
