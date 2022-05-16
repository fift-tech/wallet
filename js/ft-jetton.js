// API Endpoints
const MainNet = 'https://toncenter.com/api/v2/jsonRPC';
const TestNet = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const WalletVersion = 'v3R2';

const tonscanAddress = 'https://testnet.tonscan.org/address';

// Default system minter
const defaultMinterAddressStr = 'EQDT9tC3nHIHL3sTK7Az15rHCqhEI2JBxzCwNqowNW8OQk3B';
let targetJettonWallet = null;

// Create TonWeb object
const nacl = TonWeb.utils.nacl;
const Address = TonWeb.utils.Address;
const tonMnemonic = TonWeb.mnemonic;

const tonweb = new TonWeb(new TonWeb.HttpProvider(TestNet));

const WalletClass = tonweb.wallet.all[WalletVersion];

let keyPair = null;
let wallet_state = false;

const { JettonMinter, JettonWallet } = TonWeb.token.jetton;
const jettonContentUri = '';
let minter = null;
let strMinterAddress = '';

// Utils
function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

function prepareJetton() {
    const htmlContent = `
    <p class="text-left">
        <label class="form-label" for="jetton_name">Название Jetton (до 20 символов):</label>
        <input id="jetton_name" class="form-control" type="text"/>
        <label class="form-label" for="about_jetton">Описание (до 200 символов):</label>
        <input id="about_jetton" class="form-control" type="text" />
        <label class="form-label" for="count_jetton">Количество jetton:</label>
        <input id="count_jetton" class="form-control" type="number" />
    </p>
    `;
    $('#work').html(htmlContent);
    $('#info').html('<p></p>');
    $('#menu').html(`<button class="btn btn-primary" onclick="createJetton()">Продолжить</button>`);
}

async function createJetton() {
    // Parse prepare data
    // TODO required
    const jetton_name = $('#jetton_name').val();
    const about_jetton = $('#about_jetton').val();
    const count_jetton = $('#count_jetton').val();
    console.log(jetton_name, about_jetton, count_jetton); // DEV

    // Admin adres restore
    const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
    });
    const address = await wallet.getAddress();
    const strAddress = address.toString(true, true, true);
    console.log('Admin:', strAddress); // DEV
    // Create minter
    minter = new JettonMinter(tonweb.provider, {
        adminAddress: address,
        jettonContentUri, // TODO
        jettonWalletCodeHex: JettonWallet.codeHex,
    });
    const minterAddress = await minter.getAddress();
    strMinterAddress = minterAddress.toString(true, true, true);
    console.log('Minter address:', strMinterAddress);
    // Проверяем состояние контракта минтера
    console.log(strMinterAddress);
    const contractMinterInfo = await tonweb.provider.getAddressInfo(strMinterAddress);
    console.log(contractMinterInfo);
    if(contractMinterInfo.state === 'active') {
        console.log('Выполнить только минт');
    } else {
        console.log('Сначала выполнить деплой а потом минт')
    }
    return;
    // View
    $('#work').html(`<div>
        <div class="mt-3 fs-5">${jetton_name}</div>
        <p class="text-info">${about_jetton}</p>
        <p class="mt-2">Количество: <span class="badge bg-secondary">${count_jetton}</span></p>
        <div class="mt-2"><span class="text-success">Minter:</span> <a href="${tonscanAddress}/${strMinterAddress}">${strMinterAddress}</a></div>
        <div><span>Admin:</span> <a href="${tonscanAddress}/${strAddress}">${strAddress}</a></div>
    </div>`);
    $('#info').html(`<p></p>`);
    $('#menu').html(`<button class="btn btn-primary" onclick="deployMinter()">Деплой минтера</button>`);
}

async function deployMinter() {// Admin adres restore
    const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
    });
    const address = await wallet.getAddress();
    const strAddress = address.toString(true, true, true);
    // TODO check minter status
    sleep(5000);
    console.log('deploy minter...');
    const seqno = (await wallet.methods.seqno().call()) || 0;
    sleep(5000); // TODO view info
    const deployResult = await wallet.methods.transfer({
        secretKey: keyPair.secretKey,
        toAddress: strMinterAddress,
        amount: TonWeb.utils.toNano(0.05),
        seqno,
        payload: null,
        sendMode: 3,
        stateInit: (await minter.createStateInit()).stateInit,
    }).send();
    console.log('Deploy result:', deployResult); // DEV
    sleep(15000); // TODO view info
    mintJetton(count_jetton, address, 0.04);
}

async function mintJetton(jettonAmount, dest, amount) {
    // Mint
    const seqno = (await wallet.methods.seqno().call()) || 0;
    sleep(5000); // TODO view info
    const mintResult = await wallet.methods.transfer({
        secretKey: keyPair.secretKey,
        toAddress: strMinterAddress,
        amount: TonWeb.utils.toNano(0.05),
        seqno,
        payload: await minter.createMintBody({
            jettonAmount: TonWeb.utils.toNano(jettonAmount),
            destination: dest,
            amount: TonWeb.utils.toNano(amount),
        }),
        sendMode: 3,
    }).send();
    console.log('Mint result:', mintResult);
}

// --- new file
/**
 * @param bs    {BitString}
 * @param cursor    {number}
 * @param bits  {number}
 * @return {BigInt}
 */
 const readIntFromBitString = (bs, cursor, bits) => {
    let n = BigInt(0);
    for (let i = 0; i < bits; i++) {
        n *= BigInt(2);
        n += BigInt(bs.get(cursor + i));
    }
    return n;
}

/**
 * @param cell  {Cell}
 * @return {Address|null}
 */
const parseAddress = cell => {
    let n = readIntFromBitString(cell.bits, 3, 8);
    if (n > BigInt(127)) {
        n = n - BigInt(256);
    }
    const hashPart = readIntFromBitString(cell.bits, 3 + 8, 256);
    if (n.toString(10) + ":" + hashPart.toString(16) === '0:0') return null;
    const s = n.toString(10) + ":" + hashPart.toString(16).padStart(64, '0');
    return new Address(s);
};
// -- end file

// toJettonWallet
async function toJettonWallet(minterAddr, ownerAddress) {
    const cell = new TonWeb.boc.Cell();
    cell.bits.writeAddress(ownerAddress);
    const bocAddr = await cell.toBoc(false);
    console.log(bocAddr); // DEV
    const result = await tonweb.provider.call2(
        // minterAddress.toString(), // TODO minter address from localstorage or constant
        minterAddr,
        'get_wallet_address',
        [['tvm.Slice', (0, TonWeb.utils.bytesToBase64) (bocAddr)]],
    );
    
    const addr = (0, parseAddress) (result);
    return new JettonWallet(tonweb.provider, {
        address: addr,
    });
}

// jettonwallet info
async function getJettonWalletInfo(jettonWallet) {
    const data = await jettonWallet.getData();
    data.balance = data.balance.toString();
    data.ownerAddress = data.ownerAddress.toString(true, true, true);
    data.jettonMinterAddress = data.jettonMinterAddress.toString(true, true, true);
    return data;
}

// Tests
/*
async function test() {
    const testAddr = new Address('EQCbqpUESI_jNqUnpD2c3QoSYJuxlY67Di9D5nU7csKkzxCQ');

    const myWallet1 = await toJettonWallet(defaultMinterAddressStr, testAddr);
    console.log(myWallet1);
    sleep(5000);
    console.log(await getJettonWalletInfo(myWallet1));
}

test();
*/

async function jettonWallets(strAddress) {
    console.log('minter:', defaultMinterAddressStr); // DEV
    console.log('wallet:', strAddress); // DEV
    let walletAddress = new Address(strAddress);
    console.log(walletAddress); // DEV
    sleep(3000);
    targetJettonWallet = await toJettonWallet(
        defaultMinterAddressStr,
        walletAddress
    );
    const targetJettonWalletAddress = await targetJettonWallet.getAddress();
    const tjwaStr = targetJettonWalletAddress.toString(true, true, true);
    console.log('target jetton wallet address:', tjwaStr); // DEV
    // View
    $('#jetton-wallets').html(`
    <div class="fs-3 mt-3">Jettons</div>
    <div class="row mt-3 mb-2">
        <p class="text-start">Чтобы добавить Jetton-кошелек введите адрес минтера:</p>
        <div class="col-10">
            <input id="minter_address" class="form-control" type="text" placeholder="EQ..." />
        </div>
        <div class="col-2 text-left">
            <button type="button" class="btn btn-success" onclick="addJettonMinter()">Добавить</button>
        </div>
        <div class="row">
            <div id="minter-info" class="col-12 mt-2"></div>
        </div>
    </div>
    <hr />
    `);

    $('#jetton-wallets').append(`
    <div class="row">
        <div class="col-2 fs-6 text-success">FT-Jetton</div>
        <div class="col-8"><a class="fs-6" href="${tonscanAddress}/${tjwaStr}">${tjwaStr}</a></div>
        <div class="col-2">
            <button type="button" class="btn btn-outline-success btn-sm" onclick="openJetton()">Открыть</button>
        </div>
    </div>
    `);
}

async function openJetton() {
    console.log('target:', targetJettonWallet); // DEV

    const jwAddr = await targetJettonWallet.getAddress();
    const jwAddrStr = jwAddr.toString(true, true, true);
    console.log('jw address:', jwAddrStr);
    // view
    $('#work').html(`
    <p class="h5 mt-2">${jwAddrStr}</p>
    <p class="h5 mt-3">Загрузка данных...</p>
    `);
    $('#info').html('<p></p>');
    $('#menu').html('<p></p>');

    let addressInfo = null;
    let jetton_wallet_state = false;
    try {
        addressInfo = await tonweb.provider.getAddressInfo(jwAddrStr);
        console.log(addressInfo); // DEV
        if(addressInfo.state === 'active') {
            jetton_wallet_state = true;
        }
    } catch(err) {
        console.log('error addressInfo');
        console.log(err);
        // view
        $('#work').html('<br />');
        $('#info').html('<p class="text-warning">Возникла ошибка соединения с API</p>');
        $('#menu').html(`<button class="btn btn-primary" onclick="location.reload()">Назад</button>`);
    
        return;
    }

    $('#work').html(`
    <div id="qr" style="width: 256px; margin: auto"></div>
    <div class="mt-4"><a class="fs-5" href="${tonscanAddress}/${jwAddrStr}">${jwAddrStr}</a></div>
    <div class="mt-2">Состояние <i class="text-info">${addressInfo.state}</i></div>
    `);

	var options = {
		text: 'ton://transfer/' + jwAddrStr,
        width: 256,
        height: 256,
        colorDark : "#506070",
        colorLight : "#ffffff",
	};
	// Create QRCode Object
	new QRCode(document.getElementById("qr"), options);

    $('#info').html('<p class="text-start">Загрузка данных жетона...</p>');

    if(jetton_wallet_state) {
        sleep(2000);
        const jwInfo = await getJettonWalletInfo(targetJettonWallet);
        console.log('jw info:', jwInfo); // DEV

        $('#info').html('<p></p>');
        $('#work').append(`<p class="text-center fs-5">Баланс: <span class="text-success">${TonWeb.utils.fromNano(jwInfo.balance)}</span> Jetton</p>`);
        $('#work').append(`<div class="text-start">Владелец: <a href="${tonscanAddress}/${jwInfo.ownerAddress}">${jwInfo.ownerAddress}</a></div>`);
        $('#work').append(`<div class="text-start">Минтер: <a href="${tonscanAddress}/${jwInfo.jettonMinterAddress}">${jwInfo.jettonMinterAddress}</a></div>`);

        $('#menu').html(`<p class="mt-2"><button onclick="sendJetton()" class="btn btn-primary">Отправить Jetton</button></p>`);
    } else {
        // нужно активировать jetton wallet чтобы его смарт-контракт был задеплоен
        // иначе jw.getData() не получит инфу из блокчейна

        $('#info').html('<p></p>');
        $('#work').append(`<p class="text-center text-warning fs-5">Jetton кошелек не активирован.</p>`);

        $('#menu').html(`<p class="mt-2"><button onclick="activateJetton()" class="btn btn-success">Активировать</button></p>`);
    }
}

// activate jetton wallet
async function activateJetton() {
    console.log('activate jetton wallet');
    console.log(targetJettonWallet); // DEV

    
}

// send jettons
async function sendJetton() {
    const jwAddr = await targetJettonWallet.getAddress();
    const jwAddrStr = jwAddr.toString(true, true, true);

    const htmlContent = `
    <p class="fs-5">Перевоз жетонов из кошелька <span class="text-info">${jwAddrStr}</span></p>
    <p class="text-warning">В качестве адреса получателя жетонов нужно указывать TON-адрес кошелька</p>
    <p class="text-left">
        <label class="form-label" for="address">TON-адрес получателя:</label>
        <input id="jetton_wallet_address" class="form-control" type="text"/>
        <label class="form-label" for="amount">Количество Jetton:</label>
        <input id="jetton_amount" class="form-control" type="number" />
    </p>
    `;
    $('#work').html(htmlContent);
    $('#menu').html(`<button class="btn btn-success" onclick="sendJettonValue()">Отправить</button>`);
}

async function sendJettonValue() {
    const jetton_wallet_address = $('#jetton_wallet_address').val();
    const jetton_amount = $('#jetton_amount').val();

    console.log('send jetton value:', jetton_wallet_address, jetton_amount); // DEV
    console.log('context:', targetJettonWallet); // DEV

    // Admin adres restore
    const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
    });

    const seqno = (await wallet.methods.seqno().call()) || 0;
    console.log('seqno:', seqno);
    // transfer jetton
    sleep(2000);
    const tx_res = await wallet.methods.transfer({
        secretKey: keyPair.secretKey,
        // на свой ТОН-кошелек шлем транзакцию ?
        toAddress: await targetJettonWallet.getAddress(),
        amount: TonWeb.utils.toNano('0.4'), // TODO into const
        seqno: seqno,
        payload: await targetJettonWallet.createTransferBody({
            jettonAmount: TonWeb.utils.toNano(jetton_amount),
            toAddress: new TonWeb.utils.Address(jetton_wallet_address),
            forwardAmount: TonWeb.utils.toNano('0.1'), // TODO into constant
            forwardPayload: new TextEncoder().encode('gift'),
            responseAddress: await wallet.getAddress(),
        }),
        sendMode: 3,
    }).send();
    console.log(tx_res); // DEV
    // TODO VIEW
}

// add jetton
async function addJettonMinter() {
    const minter_address = $('#minter_address').val();

    console.log('add jetton minter:', minter_address); // DEV
    // check for active minter address
    // 1) getAddressInfo
    try {
        const minterAddressInfo = await tonweb.provider.getAddressInfo(minter_address);
        console.log(minterAddressInfo); // DEV

        $('#minter-info').html('');
    } catch(err) {
        console.log('Network API Exception:', err);
        $('#minter-info').html(`<span class="text-start text-warning">Возникла ошибка API-запроса: проверьте корректность адреса минтера</span>`);
    }
    // 2) getMinterInfo
    const target_minter = new JettonMinter(tonweb.provider, {
        address: minter_address,
    });
    console.log('tergetminter:', target_minter); // DEV
    sleep(2000);
    // TODO try catch
    const dataMinter = await minter.getJettonData();
    console.log(dataMinter);
}