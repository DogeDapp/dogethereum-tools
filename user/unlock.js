var utils = require('./utils');
var yargs = require('yargs');

async function doIt() {
  var argv = utils.completeYargs(yargs
      .option('s', {
        group: 'Data:',
        alias: 'sender',
        describe: 'from eth account',
        demandOption: true
      })
      .option('r', {
        group: 'Data:',
        alias: 'receiver',
        describe: 'doge destination address',
        demandOption: true
      })
      .option('v', {
        group: 'Data:',
        alias: 'value',
        describe: 'number of tokens to transfer',
        type: 'number',
        demandOption: true
      })
      .usage('node user/unlock.js --network <eth network> --sender <from eth account> --receiver <to doge address> --value <number of tokens>')
      .example('node user/unlock.js --network ropsten --sender 0xd2394f3fad76167e7583a876c292c86ed10305da --receiver ncbC7ZY1K9EcMVjvwbgSBWKQ4bwDWS4d5P --value 300000000')
    ).argv;

  var initObjects = utils.init(argv);
  var web3 = initObjects.web3;
  var DogeToken = initObjects.DogeToken;


  var sender = argv.sender;
  var dogeDestinationAddress = argv.receiver;
  var valueToUnlock = argv.value;

  console.log("Unlock " + utils.dogeToSatoshi(valueToUnlock) + " doge tokens from " + sender + " to " + dogeDestinationAddress + ".");

  // Do some checks
  if (!await utils.doSomeChecks(web3, sender, valueToUnlock)) {
    return;
  }

  var dt = await DogeToken.deployed();
  await utils.printDogeTokenBalances(dt, sender);
  // Do unlock
  console.log("Initiating unlock... ");
  var minUnlockValue = await dt.MIN_UNLOCK_VALUE();
  minUnlockValue = minUnlockValue.toNumber();
  if(valueToUnlock < minUnlockValue) {
    console.log("Value to unlock " + valueToUnlock + " should be at least " + minUnlockValue);
    return false;
  }  
  const operatorsLength = await dt.getOperatorsLength();
  var valueUnlocked = 0;
  for (var i = 0; i < operatorsLength; i++) {      
    let operatorKey = await dt.operatorKeys(i);
    if (operatorKey[1] == false) {
      // not deleted
      let operatorPublicKeyHash = operatorKey[0];
      let operator = await dt.operators(operatorPublicKeyHash);
      var dogeAvailableBalance = operator[1].toNumber();
      if (dogeAvailableBalance >= minUnlockValue) {
        // dogeAvailableBalance >= MIN_UNLOCK_VALUE  
        var valueToUnlockWithThisOperator = Math.min(valueToUnlock - valueUnlocked, dogeAvailableBalance);
        console.log("Unlocking " + valueToUnlockWithThisOperator + " DogeTokens using operator " + operatorPublicKeyHash);     
        await dt.doUnlock(dogeDestinationAddress, valueToUnlock, operatorPublicKeyHash, {from: sender, gas: 350000, gasPrice: argv.gasPrice});
        valueUnlocked += valueToUnlockWithThisOperator;
      }
    }
    if (valueUnlocked == valueToUnlock) {
      break;
    }
  }
  console.log("Total unlocked " + valueUnlocked + " DogeTokens from " + sender);    

  console.log("Unlock Done.");
  await utils.printDogeTokenBalances(dt, sender);
}

doIt();

