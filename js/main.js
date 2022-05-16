console.log('TonWeb', TonWeb.version);

// asyncs
async function createWallet() {
    // const m = new Mnemonic(256); // DEPRICATED
    // const seed = m.toWords();    // DEPRICATED
    const phrase = await tonMnemonic.generateMnemonic();

    // view
    $('#work').html(`
    <p>Ваша кодовая фраза:</p>
    <textarea class="form-control" rows="3" disabled>${phrase.join(' ')}</textarea>
    `);

    $('#info').html(`<p>Теперь у Вас есть кодовая фраза запешите ее в надежное место и нажмите "Восстановить"</p>`)
}

async function repairWallet() {
    $('#work').html(`
    <p>Введите кодовую фразу:</p>
    <textarea id="seed" class="form-control" rows="3"></textarea>
    `);

    $('#info').html(`<p> </p>`);

    $('#menu').html(`<button onclick="walletFromSeed()" class="btn btn-primary">Продолжить</button>`);
}

async function walletFromSeed() {
    const strSeed = $('#seed').val();
    const arrSeed = strSeed.split(' ');

    if(!tonMnemonic.validateMnemonic(arrSeed)) { // TODO rewrite on validateMnemonic
        $('#info').html(`<p class="text-warning">Не получилось вычислить кодувую фразу</p>`);
        return;
    }
    
    const seedBytes = await tonMnemonic.mnemonicToSeed(arrSeed);
    const seedHex = TonWeb.utils.bytesToHex(seedBytes);
    console.log('seed:', seedHex); // DEV
    storeHexSeed(seedHex);
    hexToWallet(seedHex);
}

function storeHexSeed(hexSeed) {
    // Add storage in ftwallet.addresses
    let ftwallet = JSON.parse(localStorage.getItem('ftwallet'));
    const wnum = ftwallet.addr_index += 1;
    ftwallet.addresses[`Wallet_${wnum}`] = hexSeed;
    console.log(ftwallet); // DEV
    localStorage.setItem('ftwallet', JSON.stringify(ftwallet));
    // add to wallet list
    addOptionToWalletList(`Wallet_${wnum}`, hexSeed);
}

async function hexToWallet(hexSeed) {
    // get TON wallet
    const bytesSeed = TonWeb.utils.hexToBytes(hexSeed);
    keyPair = TonWeb.utils.nacl.sign.keyPair.fromSeed(bytesSeed);
    // console.log(keyPair); // DEV
    const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
    });
    const address = await wallet.getAddress();
    const strAddress = address.toString(true, true, true);

    $('#work').html(`
    <p class="h5 mt-2">${strAddress}</p>
    <p class="h5 mt-3">Загрузка данных...</p>
    `);

    $('#info').html(`<p></p>`);

    let walletInfo = null;
    try {
        walletInfo = await tonweb.provider.getAddressInfo(strAddress);
        console.log(walletInfo); // DEV
        if(walletInfo.state === 'active') {
            wallet_state = true;
        }
    } catch(err) {
        $('#work').html('<br />');
        $('#info').html(`<p class="text-warning">Возникла ошибка соединения с API</p>`);
        console.log(err);
        $('#menu').html(`<button class="btn btn-primary" onclick="location.reload()">Назад</button>`);
  
        return;
    }
    
    $('#work').html(`
    <div id="qr" style="width: 256px; margin: auto"></div>
    <div class="mt-4"><a class="fs-5" href="${tonscanAddress}/${strAddress}">${strAddress}</a></div>
    <div class="mt-2">Состояние <i class="text-info">${walletInfo.state}</i></div>
    <div class="fs-5 mt-2">Баланс <span class="text-info">${TonWeb.utils.fromNano(walletInfo.balance)}</span> TON</div>
    `);

	var options = {
		text: 'ton://transfer/' + strAddress,
        width: 256,
        height: 256,
        colorDark : "#506070",
        colorLight : "#ffffff",
	};
	// Create QRCode Object
	new QRCode(document.getElementById("qr"), options);

    $('#menu').html(`<button onclick="sendTon()" class="btn btn-primary">Отправить TON</button>  <button class="btn btn-success" onclick="prepareJetton()">Выпустить jetton</button>`);

    jettonWallets(strAddress); 
}

async function sendTon() {
    const htmlContent = `
    <p class="text-left">
        <label class="form-label" for="address">Адрес получателя:</label>
        <input id="address" class="form-control" type="text"/>
        <label class="form-label" for="amount">Количество TON:</label>
        <input id="amount" class="form-control" type="number" />
        <label class="form-label" for="paeload">Сообщение:</label>
        <input id="payload" class="form-control" type="text" />
    </p>
    `;
    $('#work').html(htmlContent);
    $('#menu').html(`<button class="btn btn-primary" onclick="sendValue()">Отправить</button>`);
}

async function sendValue() {
    const address = $('#address').val();
    const amount = $('#amount').val();
    const payload = $('#payload').val();
    // console.log(keyPair, address, amount, payload); // DEV
    const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
    });
    
    console.log(wallet_state); // DEV
    // Deploy wallet if state = false
    if(!wallet_state) { // Проверять нужно статус
        $('#info').html('<p>Создается кошелек в блокчейне...</p>');
        sleep(2000);
        const deployResult = await wallet.deploy(keyPair.secretKey).send();
        const deployResultStr = JSON.stringify(deployResult);
        console.log(deployResultStr); // DEV
        const str = deployResultStr.replace(/@/g, '');
        console.log(str); // DEV
        const deployObj = JSON.parse(str);
        console.log(deployObj);
        // Вывести что создался (или нет) кошель
        if(deployObj.type === 'ok') {
            // FOR
            for(let i = 0; i <= 5; i++) {
                sleep(5000);
                let addr = await wallet.getAddress();
                console.log(addr.toString(true, true, true));
                const walletInfo = await tonweb.provider.getAddressInfo(addr.toString(true, true, true));
                console.log(walletInfo.state); // DEV
                if(walletInfo.state === 'active') {
                    wallet_state = true;
                    break;
                }
                $('#info').html(`<p class="text-warning">Проверка активации ${i + 2} из 5...</p>`);
            }

            if(!wallet_state) {
                $('#info').html('<p class="text-warning">Активация кошелька за время ожидания не удалось. Рекомендуется повторить отправку транзакции через несколько минут.</p>');                

                return;
            }

            $('#info').html('<p>Отправляется транзакция...</p>');
            // sleep(5000); // 5 sec timeout
            // let seqno = await wallet.methods.seqno().call();
            let seqno = 1;
            console.log('seqno:', seqno) // DEV - null if unactive wallet contract
            sleep(2000);
            const tx = wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: address,
                amount: TonWeb.utils.toNano(amount),
                seqno: seqno,
                payload: payload,
                sendMode: 3,
            });
            sleep(2000);
            const txSend = await tx.send();
            console.log(txSend);
            const txSendStr = JSON.stringify(txSend);
            console.log(txSendStr); // DEV
            const str = txSendStr.replace(/@/g, '');
            console.log(str); // DEV
            const txSendObj = JSON.parse(str);
            console.log(txSendObj);
            // TODO
            if(txSendObj.type === 'ok') {
                $('#info').html(`<p class="text-success">Транзакция отправлена. Получаем чек...</p>`)
                sleep(2000);
                const getQuery = await tx.getQuery();
                const txHash = TonWeb.utils.bytesToHex(await getQuery.hash());
                console.log(txHash); // DEV
                $('#work').html(`
                <p>Чек:</p>
                <textarea class="form-control" rows="3" disabled>${txHash}</textarea>
                `);
                $('#info').html(`<p class="text-success">Выполнено!</p>`);
                $('#menu').html(`<button class="btn btn-primary" onclick="location.reload()">В кошелек</button>`);
            } else {
                $('#info').html(`<p class="text-warning">Ошибка: ${txSendObj.code} ${txSendObj.message}`);
                return;
            }
            return;
        } else {
            $('#info').html(`<p class="text-warning">Кошелек не создан. Ошибка: ${deployObj.code} ${deployObj.message}`);
            return;
        }
    }

    // Create and send transaction
    $('#info').html('<p>Отправляется транзакция...</p>');
    sleep(3000);
    let seqno = (await wallet.methods.seqno().call()) || 0;
    console.log('seqno:', seqno) // DEV - null if unactive wallet contract
    sleep(3000);
    const tx = wallet.methods.transfer({
        secretKey: keyPair.secretKey,
        toAddress: address,
        amount: TonWeb.utils.toNano(amount),
        seqno: seqno,
        payload: payload,
        sendMode: 3,
    });
    const txSend = await tx.send();
    console.log(txSend);
    const txSendStr = JSON.stringify(txSend);
    console.log(txSendStr); // DEV
    const str = txSendStr.replace(/@/g, '');
    console.log(str); // DEV
    const txSendObj = JSON.parse(str);
    console.log(txSendObj);
    // TODO
    if(txSendObj.type === 'ok') {
        $('#info').html(`<p class="text-success">Транзакция отправлена. Получаем чек...</p>`)
        sleep(2000);
        const getQuery = await tx.getQuery();
        const txHash = TonWeb.utils.bytesToHex(await getQuery.hash());
        console.log(txHash); // DEV
        $('#work').html(`
        <p>Чек:</p>
        <textarea class="form-control" rows="3" disabled>${txHash}</textarea>
        `);
        $('#info').html(`<p class="text-success">Выполнено!</p>`);
        $('#menu').html(`<button class="btn btn-primary" onclick="location.reload()">В кошелек</button>`);
    } else {
        $('#info').html(`<p class="text-warning">Ошибка: ${txSendObj.code} ${txSendObj.message}`);
        return;
    }
}

// wallet-list utils

// Add option to select wallet-list
function addOptionToWalletList(name, hex) {
    $('#wallet-list').append(`<option value="${hex}">${name}</option>`);
}

// wallet adress selected listener
$('#wallet-list').on('change', async () => {
    const optval = $('#wallet-list option:selected').val();
    // console.log('List change:', optval); // DEV
    hexToWallet(optval);
});

/* main */
async function main() {
    // delete from apps console for modified
    if(!localStorage.getItem('ftwallet')) {
        const obj = new Object();
        obj.version = '0.0.3';
        // ton addresses
        obj.addr_index = 0;
        obj.addresses = new Object();
        // minters
        obj.minter_index = 0;
        obj.minters = new Object();
        
        localStorage.setItem('ftwallet', JSON.stringify(obj));
    }

    let ftwallet = JSON.parse(localStorage.getItem('ftwallet'));
    // if(!ftwallet.addresses.length) return;
    console.log('FTWallet', ftwallet.version);
    console.log(ftwallet.addr_index); // DEV
    for(let key in ftwallet.addresses) {
        // console.log(key, ftwallet.addresses[key]);
        addOptionToWalletList(key, ftwallet.addresses[key]);
    }

    // DEV
    console.log(ftwallet.minter_index); // DEV
    for(let key in ftwallet.minters) {
        console.log(key, ftwallet.minters[key]);
    }
}

main();