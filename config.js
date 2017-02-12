// Global configuration options for IOGrid back end

module.exports = {
    // Having a large world (lower player density) is more efficient.
    // You can divide it up into cells to split up the workload between
    // multiple CPU cores.
    WORLD_WIDTH: 4000,
    WORLD_HEIGHT: 4000,
    // Dividing the world into tall vertical strips (instead of square cells)
    // tends to be more efficient (but this may vary depending on your use case
    // and world size).
    WORLD_CELL_WIDTH: 4000,
    WORLD_CELL_HEIGHT: 4000,
    /*
     The WORLD_CELL_OVERLAP_DISTANCE allows players/states from two different
     cells on the grid to interact with one another.
     States from different cells will show up in your cell controller but will have a
     special 'external' property set to true.
     This represents the maximum distance that two states can be from one another if they
     are in different cells and need to interact with one another.
     A smaller value is more efficient. Since this overlap area requires coordination
     between multiple cells.
     */
    WORLD_CELL_OVERLAP_DISTANCE: 150,
    /*
     This is the interval (in milliseconds) within which the world updates itself.
     It also determines the frequency at which data is broadcast to users.
     Making this value higher will boost performance and reduce bandwidth consumption
     but will increase lag. 20ms is actually really fast - If you add some sort of
     motion smoothing on the front end, 50ms or higher should be more than adequate.
     */
    WORLD_UPDATE_INTERVAL: 20,
    // Delete states which have gone stale (not being updated anymore).
    WORLD_STALE_TIMEOUT: 1000,
    // Coins don't move, so we will only refresh them
    // once per second.
    SPECIAL_UPDATE_INTERVALS: {
        1000: ['coin']
    },

    PLAYER_DEFAULT_MOVE_SPEED: 10,
    PLAYER_DIAMETER: 45,
    PLAYER_MASS: 20,

    COIN_UPDATE_INTERVAL: 1000,
    COIN_DROP_INTERVAL: 100,
    COIN_MAX_COUNT: 200,
    COIN_PLAYER_NO_DROP_RADIUS: 60,
    // The probabilities need to add up to 1.
    COIN_TYPES: [
      {
        type: 1,
        value: 'scrap',
        radius: 10,
        probability: 0.60
      },
      {
        type: 2,
        value: 'wire',
        radius: 7,
        probability: 0.30
      },
      {
        type: 3,
        value: 'chip',
        radius: 10,
        probability: 0.09
      },
      {
        type: 4,
        value: 'quantumChip',
        radius: 8,
        probability: 0.01
      }
    ],

    // cost: [scrap, wire, chips]
    UPGRADES: [
        // Tier 1
        {
          id: 1,
          desc: 'Health',
          cost: [5, 2, 0],
          effects: {
            health: 5,
            maxHealth: 5
          }
        },
        {
          id: 1,
          desc: 'Attack',
          cost: [5, 2, 0],
          effects: {
            attack: 2
          }
        },
        // Tier 2
        {
          id: 2,
          desc: 'Attack',
          cost: [7, 3, 0],
          effects: {
            attack: 3
          }
        },
        {
          id: 2,
          desc: 'Armor',
          cost: [7, 3, 0],
          effects: {
            defense: 2
          }
        },
        // Tier 3
        {
          id: 3,
          desc: 'Armor',
          cost: [10, 5, 1],
          effects: {
            defense: 3
          }
        },
        {
          id: 3,
          desc: 'Health',
          cost: [10, 5, 1],
          effects: {
            health: 10,
            maxHealth: 10
          }
        },
        // Tier 4
        {
          id: 4,
          desc: 'Attack',
          cost: [12, 6, 2],
          effects: {
            attack: 5
          }
        },
        {
          id: 4,
          desc: 'Health',
          cost: [12, 6, 2],
          effects: {
            health: 10,
            maxHealth: 10
          }
        },
        // Tier 5
        {
          id: 5,
          desc: 'Armor',
          cost: [13, 8, 2],
          effects: {
            defense: 5
          }
        },
        {
          id: 5,
          desc: 'Attack',
          cost: [13, 8, 2],
          effects: {
            attack: 6
          }
        },
        // Tier 6
        {
          id: 6,
          desc: 'Health',
          cost: [0, 0, 5],
          effects: {
            health: 15,
            maxHealth: 15
          }
        },
        {
          id: 6,
          desc: 'Armor',
          cost: [0, 0, 5],
          effects: {
            defense: 6
          }
        },
        // Tier 7
        {
          id: 7,
          desc: 'Attack',
          cost: [0, 10, 5],
          effects: {
            attack: 8
          }
        },
        {
          id: 7,
          desc: 'Health',
          cost: [0, 10, 5],
          effects: {
            health: 15,
            maxHealth: 15
          }
        },
        // Tier 8
        {
          id: 8,
          desc: 'Armor',
          cost: [10, 10, 7],
          effects: {
            defense: 8
          }
        },
        {
          id: 8,
          desc: 'Health',
          cost: [10, 10, 7],
          effects: {
            health: 20,
            maxHealth: 20
          }
        },
        // Tier 9
        {
          id: 9,
          desc: 'Attack',
          cost: [15, 10, 10],
          effects: {
            attack: 10
          }
        },
        {
          id: 9,
          desc: 'Armor',
          cost: [15, 10, 10],
          effects: {
            defense: 10
          }
        }
    ],

    // We can use this to filter out properties which don't need to be sent
    // to the front end.
    OUTBOUND_STATE_TRANSFORMERS: {
        coin: genericStateTransformer,
        player: genericStateTransformer
    }
};

var privateProps = {
    ccid: true,
    tcid: true,
    mass: true,
    speed: true,
    changeDirProb: true,
    repeatOp: true,
    swid: true,
    processed: true,
    pendingGroup: true,
    group: true,
    version: true,
    external: true
};

function genericStateTransformer(state) {
    var clone = {};
    Object.keys(state).forEach(function (key) {
        if (!privateProps[key]) {
            clone[key] = state[key];
        }
    });
    return clone;
}
