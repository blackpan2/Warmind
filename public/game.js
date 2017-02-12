function gameFunction() {
    var game, playerId, player;
    users = {};
    coins = {};

    var WORLD_WIDTH;
    var WORLD_HEIGHT;
    var WORLD_COLS;
    var WORLD_ROWS;
    var WORLD_CELL_WIDTH;
    var WORLD_CELL_HEIGHT;
    var PLAYER_LINE_OF_SIGHT = Math.round(window.innerWidth);
    var PLAYER_INACTIVITY_TIMEOUT = 700;
    var USER_INPUT_INTERVAL = 20;
    var COIN_INACTIVITY_TIMEOUT = 2200;
    var ENVIRONMENT;
    var SERVER_WORKER_ID;

    var youTextures = {
        up: 'img/simplebot_back.gif',
        left: 'img/simplebot_left.gif',
        right: 'img/simplebot_right.gif',
        down: 'img/simplebot_front.gif'
    };

    var othersTextures = {
        up: 'img/simplebot_back.gif',
        left: 'img/simplebot_left.gif',
        right: 'img/simplebot_right.gif',
        down: 'img/simplebot_front.gif'
    };

    // Mapping of different resources that can spawn
    var resourceTextures = {
        1: 'img/scrap_metal.gif',
        2: 'img/wire.png',
        3: 'img/chip.gif',
        4: 'img/quantum_chip.gif'
    }

    // 1 means no smoothing. 0.1 is quite smooth.
    var CAMERA_SMOOTHING = 1;
    var BACKGROUND_TEXTURE = 'img/factory_floor_tile.gif';

    socket.emit('getWorldInfo', null, function (err, data) {
        WORLD_WIDTH = data.width;
        WORLD_HEIGHT = data.height;
        WORLD_COLS = data.cols;
        WORLD_ROWS = data.rows;
        WORLD_CELL_WIDTH = data.cellWidth;
        WORLD_CELL_HEIGHT = data.cellHeight;
        WORLD_CELL_OVERLAP_DISTANCE = data.cellOverlapDistance;
        SERVER_WORKER_ID = data.serverWorkerId;
        ENVIRONMENT = data.environment;

        channelGrid = new ChannelGrid({
            worldWidth: WORLD_WIDTH,
            worldHeight: WORLD_HEIGHT,
            rows: WORLD_ROWS,
            cols: WORLD_COLS,
            cellOverlapDistance: WORLD_CELL_OVERLAP_DISTANCE,
            exchange: socket
        });

        game = new Phaser.Game('100', '100', Phaser.AUTO, '', {
            preload: preload,
            create: create,
            render: render,
            update: update
        });
    });

    function preload() {
        keys = {
            up: game.input.keyboard.addKey(Phaser.Keyboard.UP),
            down: game.input.keyboard.addKey(Phaser.Keyboard.DOWN),
            right: game.input.keyboard.addKey(Phaser.Keyboard.RIGHT),
            left: game.input.keyboard.addKey(Phaser.Keyboard.LEFT)
        };

        game.load.image('background', BACKGROUND_TEXTURE);

        game.load.image('you-up', youTextures.up);
        game.load.image('you-down', youTextures.down);
        game.load.image('you-right', youTextures.right);
        game.load.image('you-left', youTextures.left);

        game.load.image('others-up', othersTextures.up);
        game.load.image('others-down', othersTextures.down);
        game.load.image('others-right', othersTextures.right);
        game.load.image('others-left', othersTextures.left);

        game.load.image('resource-1', resourceTextures[1]);
        game.load.image('resource-2', resourceTextures[2]);
        game.load.image('resource-3', resourceTextures[3]);
        game.load.image('resource-4', resourceTextures[4]);

        game.load.image('scrap-icon', 'img/scrap_metal_icon.gif');
    }

    function handleCellData(stateList) {
        stateList.forEach(function (state) {
            if (state.type == 'player') {
                updateUser(state);
            } else if (state.type == 'coin') {
                if (state.delete) {
                    removeCoin(state);
                } else {
                    renderCoin(state);
                }
            }
        });
        updatePlayerZIndexes();
    }

    var watchingCells = {};

    /*
     Data channels within our game are divided a grids and we only watch the cells
     which are within our player's line of sight.
     As the player moves around the game world, we need to keep updating the cell subscriptions.
     */
    function updateCellWatchers(playerData, channelName, handler) {
        var options = {
            lineOfSight: PLAYER_LINE_OF_SIGHT
        };
        channelGrid.updateCellWatchers(playerData, channelName, options, handler);
    }

    function updateUserGraphics(user) {
        user.sprite.x = user.x;
        user.sprite.y = user.y;

        if (!user.direction) {
            user.direction = 'down';
        }
        user.sprite.loadTexture(user.texturePrefix + '-' + user.direction);

        user.label.alignTo(user.sprite, Phaser.BOTTOM_CENTER, 0, 10);
    }

    function moveUser(userId, x, y) {
        var user = users[userId];
        user.x = x;
        user.y = y;
        updateUserGraphics(user);
        user.clientProcessed = Date.now();

        if (user.id == playerId) {
            updateCellWatchers(user, 'cell-data', handleCellData);
        }
    }

    function removeUser(userData) {
        var user = users[userData.id];
        if (user) {
            user.sprite.destroy();
            user.label.destroy();
            delete users[userData.id];
        }
    }

    function createTexturedSprite(options) {
        var sprite = game.add.sprite(0, 0, options.texture);
        sprite.anchor.setTo(0.5);

        return sprite;
    }

    function createUserSprite(userData) {
        var user = {};
        users[userData.id] = user;
        user.id = userData.id;
        user.swid = userData.swid;
        user.name = userData.name;

        var textStyle = {
            font: '16px Arial',
            fill: '#ff000d',
            align: 'center'
        };

        user.label = game.add.text(0, 0, user.name, textStyle);
        user.label.anchor.set(0.5);

        var sprite;

        if (userData.id == playerId) {
            sprite = createTexturedSprite({
                texture: 'you-down'
            });
            user.texturePrefix = 'you';
        } else {
            sprite = createTexturedSprite({
                texture: 'others-down'
            });
            user.texturePrefix = 'others';
        }

        user.health = userData.health;
        user.scrap = userData.scrap;
        user.wire = userData.wire;
        user.chips = userData.chips;
        user.quantumChip = userData.quantumChip;
        user.availableUpgrades = userData.availableUpgrades;
        user.sprite = sprite;

        user.sprite.width = Math.round(userData.diam * 0.73);
        user.sprite.height = userData.diam;
        user.diam = user.sprite.width;

        moveUser(userData.id, userData.x, userData.y);

        if (userData.id == playerId) {
            player = user;
            game.camera.setSize(window.innerWidth, window.innerHeight);
            game.camera.follow(user.sprite, null, CAMERA_SMOOTHING, CAMERA_SMOOTHING);
        }
    }

    function updatePlayerZIndexes() {
        var usersArray = [];
        for (var i in users) {
            if (users.hasOwnProperty(i)) {
                usersArray.push(users[i]);
            }
        }
        usersArray.sort(function (a, b) {
            if (a.y < b.y) {
                return -1;
            }
            if (a.y > b.y) {
                return 1;
            }
            return 0;
        });
        usersArray.forEach(function (user) {
            user.label.bringToTop();
            user.sprite.bringToTop();
        });
    }

    function updateUser(userData) {
        var user = users[userData.id];
        if (user) {
            user.health = userData.health;
            user.scrap = userData.scrap;
            user.wire = userData.wire;
            user.chips = userData.chips;
            user.quantumChip = userData.quantumChip;
            user.availableUpgrades = userData.availableUpgrades;
            user.direction = userData.direction;
            moveUser(userData.id, userData.x, userData.y);
        } else {
            createUserSprite(userData);
        }
    }

    function removeCoin(coinData) {
        var coinToRemove = coins[coinData.id];
        if (coinToRemove) {
            coinToRemove.sprite.destroy();
            delete coins[coinToRemove.id];
        }
    }

    function renderCoin(coinData) {
        if (coins[coinData.id]) {
            coins[coinData.id].clientProcessed = Date.now();
        } else {
            var coin = coinData;
            coins[coinData.id] = coin;
            coin.sprite = createTexturedSprite({
                texture: 'resource-' + (coinData.t || '1')
            });
            coin.sprite.x = coinData.x;
            coin.sprite.y = coinData.y;
            coin.clientProcessed = Date.now();
        }
    }

    function create() {
        background = game.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'background');
        game.time.advancedTiming = true;
        game.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        scrap_icon = createTexturedSprite({
            texture: 'scrap-icon'
        });

        // Generate a random name for the user.
        var playerName = 'user-' + Math.round(Math.random() * 10000);

        function joinWorld() {
            socket.emit('join', {
                name: playerName,
            }, function (err, playerData) {
                playerId = playerData.id;
                updateCellWatchers(playerData, 'cell-data', handleCellData);
            });
        }

        function removeAllUserSprites() {
            for (var i in users) {
                if (users.hasOwnProperty(i)) {
                    removeUser(users[i]);
                }
            }
        }

        if (socket.state == 'open') {
            joinWorld();
        }
        // For reconnect
        socket.on('connect', joinWorld);
        socket.on('disconnect', removeAllUserSprites);
    }

    var lastActionTime = 0;

    function update() {
        var didAction = false;
        var playerOp = {};
        if (keys.up.isDown) {
            playerOp.u = 1;
            didAction = true;
        }
        if (keys.down.isDown) {
            playerOp.d = 1;
            didAction = true;
        }
        if (keys.right.isDown) {
            playerOp.r = 1;
            didAction = true;
        }
        if (keys.left.isDown) {
            playerOp.l = 1;
            didAction = true;
        }
        if (didAction && Date.now() - lastActionTime >= USER_INPUT_INTERVAL) {
            lastActionTime = Date.now();
            // Send the player operations for the server to process.
            socket.emit('action', playerOp);
        }
    }

    function render() {
        var now = Date.now();
        currY = 14;
        dY = 16;
        if (ENVIRONMENT == 'dev') {
            if (player) {
                game.debug.text('Health: ' + player.health, 2, currY, "#00FF00");
                currY += dY;
                game.debug.text('Scrap: ' + player.scrap, 2, currY, "#00FF00");
                currY += dY;
                game.debug.text('Wire: ' + player.wire, 2, currY, "#00FF00");
                currY += dY;
                game.debug.text('Chips: ' + player.chips, 2, currY, "#00FF00");
                currY += dY;
                if (player.quantumChip > 0) {
                    game.debug.text('Quantum Upgrade Available!', 2, currY, "#00FF00");
                    currY += dY;
                }
                if (player.availableUpgrades.length > 0) {
                    game.debug.text('Upgrades:', 2, currY+dY, "#00FF00");
                    currY += dY*2;
                    player.availableUpgrades.forEach(function (upgrade, index) {
                        game.debug.text(upgrade.cost.toString(), 6, currY, "#00FF00");
                        currY += dY;
                        // game.debug.spriteInfo('scrap_icon', 100, 100);
                        game.debug.text('[' + (index+1) + '] ' + upgrade.desc, 2, currY, "#00FF00");
                        currY += dY;
                    });
                }
            }
        }

        for (var i in users) {
            if (users.hasOwnProperty(i)) {
                var curUser = users[i];
                if (now - curUser.clientProcessed > PLAYER_INACTIVITY_TIMEOUT) {
                    removeUser(curUser);
                }
            }
        }

        for (var j in coins) {
            if (coins.hasOwnProperty(j)) {
                var curCoin = coins[j];
                if (now - curCoin.clientProcessed > COIN_INACTIVITY_TIMEOUT) {
                    removeCoin(curCoin);
                }
            }
        }
    }
};