
Goals:
3. Test endpoints with devnet env and testnet env, there shouldnt be errors
4. move the mass wallet code fixtures from the jito test, to a wallet service files, should be distribute.ts and reclaim.ts with tests for each, and add endpoints for that, make sure they use wallet labels
5. Start adding the bot endpoints
   - two simple bots maybe, buy, sell, 
   - simple Volume bot
   - simple Jito bundle bot for pumpfun
   - think about it intelligently like distribution and cleanup when done
   - how we can pipe the results of a bot run to another bot or something if its not complicated
6. Test API V1, good copy finish. above should be enough for a bot
  -  pumpfun launch
  -  wallets

Future
- Volume bot
- KEEEP CHANGES SIMPLE, we want backend to be flexible
****