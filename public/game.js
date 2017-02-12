function gameFunction() {
  console.log("top of gameFunction")
    var game, playerId, player;
    var users = {};
    var coins = {};

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

    var quantumPotentialTextures = {
        up: 'img/mega_tank_back.gif',
        left: 'img/mega_tank_left.gif',
        right: 'img/mega_tank_right.gif',
        down: 'img/mega_tank_front.gif'
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
        4: 'img/quantum_chip.gif',
        5: 'img/bullet1.gif'
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
            spacebar: game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR),
            up: game.input.keyboard.addKey(Phaser.Keyboard.UP),
            down: game.input.keyboard.addKey(Phaser.Keyboard.DOWN),
            right: game.input.keyboard.addKey(Phaser.Keyboard.RIGHT),
            left: game.input.keyboard.addKey(Phaser.Keyboard.LEFT),
            q: game.input.keyboard.addKey(Phaser.Keyboard.Q),
            e: game.input.keyboard.addKey(Phaser.Keyboard.E),
            one: game.input.keyboard.addKey(Phaser.Keyboard.ONE),
            two: game.input.keyboard.addKey(Phaser.Keyboard.TWO),
            three: game.input.keyboard.addKey(Phaser.Keyboard.THREE),
            four: game.input.keyboard.addKey(Phaser.Keyboard.FOUR),
            five: game.input.keyboard.addKey(Phaser.Keyboard.FIVE)
        };

        prevKeyUp = {
            spacebar: false,
            q: false,
            e: false,
            one: false,
            two: false,
            three: false,
            four: false,
            five: false
        }

        game.load.image('background', BACKGROUND_TEXTURE);

        game.load.image('you-up', youTextures.up);
        game.load.image('you-down', youTextures.down);
        game.load.image('you-right', youTextures.right);
        game.load.image('you-left', youTextures.left);

        game.load.image('quantum-up', quantumPotentialTextures.up);
        game.load.image('quantum-down', quantumPotentialTextures.down);
        game.load.image('quantum-right', quantumPotentialTextures.right);
        game.load.image('quantum-left', quantumPotentialTextures.left);

        game.load.image('others-up', othersTextures.up);
        game.load.image('others-down', othersTextures.down);
        game.load.image('others-right', othersTextures.right);
        game.load.image('others-left', othersTextures.left);

        game.load.image('resource-1', resourceTextures[1]);
        game.load.image('resource-2', resourceTextures[2]);
        game.load.image('resource-3', resourceTextures[3]);
        game.load.image('resource-4', resourceTextures[4]);
        game.load.image('bullet1', resourceTextures[5]);

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
        if (user.quantumPotential) {
            user.texturePrefix = 'quantum'
        } else {
            user.texturePrefix = 'you'
        }

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

        //player.myval = 500;

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
        user.attack = userData.attack;
        user.defense = userData.defense;
        user.scrap = userData.scrap;
        user.wire = userData.wire;
        user.chips = userData.chips;
        user.quantumChip = userData.quantumChip;
        user.quantumPotential = userData.quantumPotential;
        user.quantumPotentialTimeout = userData.quantumPotentialTimeout;
        user.availableUpgrades = userData.availableUpgrades;
        user.purchasedUpgrades = userData.purchasedUpgrades;
        user.sprite = sprite;

        user.sprite.width = Math.round(userData.diam * 0.73);
        user.sprite.height = userData.diam;
        user.diam = user.sprite.width;

        user.weapon = game.add.weapon(30, 'bullet1');
        user.weapon.bulletKillType = Phaser.Weapon.KILL_WORLD_BOUNDS;
        //  The speed at which the bullet is fired
        user.weapon.bulletSpeed = 400;
        //  Speed-up the rate of fire, allowing them to shoot 1 bullet every 200ms
        user.weapon.fireRate = 200;
        //  Add a variance to the bullet speed by +- this value
        user.weapon.bulletSpeedVariance = 200;
        user.weapon.trackSprite(sprite, 14, 0);

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
            user.attack = userData.attack;
            user.defense = userData.defense;
            user.scrap = userData.scrap;
            user.wire = userData.wire;
            user.chips = userData.chips;
            user.quantumChip = userData.quantumChip;
            user.quantumPotential = userData.quantumPotential;
            user.quantumPotentialTimeout = userData.quantumPotentialTimeout;
            user.availableUpgrades = userData.availableUpgrades;
            user.purchasedUpgrades = userData.purchasedUpgrades;
            user.direction = userData.direction;
            user.weapon = userData.weapon;
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

        // Generate a random name for the user.
        // var playerName = 'user-' + Math.round(Math.random() * 10000);
        var playerName = getUrlVars()["u"];

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

        if (keys.q.isDown && !prevKeyUp.q && player.scrap > 0 && player.health < player.maxHealth) {
            prevKeyUp.q = true;
            playerOp.repair = true;
            didAction = true;
        } else if (keys.q.isUp) {
            prevKeyUp.q = false;
        }

        if (keys.e.isDown && player.quantumChip > 0) {
            playerOp.quantumPotential = 'true';
            setTimeout(function(){
                playerOp = {quantumPotential: 'false'};
                socket.emit('action', playerOp);
            }, 10000);
            didAction = true;
        }

        if (keys.spacebar.isDown) {
            playerOp.spacebar_pressed = 1;
            //if(player) player.weapon.fire();
            didAction = true;
        } else if (keys.spacebar.isUp) {
            prevKeyUp.spacebar = false;
        }

        if (keys.one.isDown && player.availableUpgrades.length >= 1) {
            playerOp.upgrade = player.availableUpgrades[0];
            didAction = true;
        } else if (keys.one.isUp) {
            prevKeyUp.one = false;
        }
        if (keys.two.isDown && !prevKeyUp.two && player.availableUpgrades.length >= 2) {
            prevKeyUp.two = true;
            playerOp.upgrade = player.availableUpgrades[1];
            didAction = true;
        } else if (keys.two.isUp) {
            prevKeyUp.two = false;
        }
        if (keys.three.isDown && !prevKeyUp.three && player.availableUpgrades.length >= 3) {
            prevKeyUp.three = true;
            playerOp.upgrade = player.availableUpgrades[2];
            didAction = true;
        } else if (keys.three.isUp) {
            prevKeyUp.three = false;
        }
        if (keys.four.isDown && !prevKeyUp.four && player.availableUpgrades.length >= 4) {
            prevKeyUp.four = true;
            playerOp.upgrade = player.availableUpgrades[3];
            didAction = true;
        } else if (keys.four.isUp) {
            prevKeyUp.four = false;
        }
        if (keys.five.isDown && !prevKeyUp.five && player.availableUpgrades.length >= 5) {
            prevKeyUp.five = true;
            playerOp.upgrade = player.availableUpgrades[4];
            didAction = true;
        } else if (keys.five.isUp) {
            prevKeyUp.five = false;
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
                if (player.health < player.maxHealth) {
                    game.debug.text('Repair: \'Q\' (1 scrap)', window.innerWidth/2-70, 14, "#00FF00");
                }
                if (player.quantumChip > 0) {
                    game.debug.text('Activate Quantum Potential (Press \'E\')', window.innerWidth/2-125, 30, "#00FF00");
                }
                game.debug.text('Health: ' + player.health, 2, currY, "#00FF00");
                currY += dY;
                game.debug.text('Attack: ' + player.attack, 2, currY, "#00FF00");
                currY += dY;
                game.debug.text('Armor: ' + player.defense, 2, currY, "#00FF00");
                currY += dY;
                game.debug.text('Scrap: ' + player.scrap, 2, currY+dY, "#00FF00");
                currY += dY*2;
                game.debug.text('Wire: ' + player.wire, 2, currY, "#00FF00");
                currY += dY;
                game.debug.text('Chips: ' + player.chips, 2, currY, "#00FF00");
                currY += dY;
                // game.debug.text('Purchased Upgrades: ' + player.purchasedUpgrades.toString(), 2, currY, "#00FF00");
                // currY += dY;
                if (player.availableUpgrades.length > 0) {
                    game.debug.text('Upgrades:', 2, currY+dY, "#00FF00");
                    currY += dY*2;
                    player.availableUpgrades.forEach(function (upgrade, index) {
                        game.debug.text('[' + (index+1) + '] ' + upgrade.desc, 2, currY, "#00FF00");
                        currY += dY;
                        var costString = '-> ';
                        if (upgrade.cost[0] > 0) {
                            costString += upgrade.cost[0] + ' Scrap '
                        }
                        if (upgrade.cost[1] > 0) {
                            costString += upgrade.cost[1] + ' Wire '
                        }
                        if (upgrade.cost[2] > 0) {
                            costString += upgrade.cost[2] + ' Chips'
                        }
                        game.debug.text(costString, 15, currY, "#00FF00");
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
}

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}
