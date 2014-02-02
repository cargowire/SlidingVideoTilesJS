
// Utilities
if (typeof (Array.prototype.shuffle) === "undefined") {
    Array.prototype.shuffle = function () {
        var counter = this.length, temp, index;

        while (counter > 0)
        {
            index = Math.floor(Math.random() * counter);
            counter--;

            temp = this[counter];
            this[counter] = this[index];
            this[index] = temp;
        }

        return this;
    }
}

// TileGame module
var TileGame = (function () {

    var TileGame = {};

    // Initializes a slot with a destination 2d context
    TileGame.Slot = function (dest) {
        this.dest = dest;
    };

    // Slots can be drawn using their pixelX, pixelY, width and height
    // which relate to sections within the final rendering
    TileGame.Slot.prototype.draw = function ()
    {
        if (this.tile)
        {
            this.tile.draw(this.pixelX, this.pixelY);
        }

        // Draw slot boundary
        this.dest.rect(this.pixelX, this.pixelY, this.width, this.height);
        this.dest.stroke();
    }

    // Slots can be clicked but only react if the click was within their bounds
    TileGame.Slot.prototype.hitTest = function (x, y)
    {
        return (x > this.pixelX && x < this.pixelX + this.width
            && y > this.pixelY && y < this.pixelY + this.height);
    }

    // Initializes a tile - a part of the image that can be moved with
    // a source canvas, a destination canvas and the position/size within the
    // source canvas that they render
    TileGame.Tile = function (src, dest, name, x, y, width, height) {
        this.name = name;
        this.src = src;
        this.dest = dest;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    };

    // Draws the tile in a specific place on screen
    TileGame.Tile.prototype.draw = function (x, y) {
        var iData = this.src.getImageData(this.x, this.y, this.width, this.height)
        this.dest.putImageData(iData, x, y);
    }

    // Represents the game object which is initialized with a source video and a number
    // sections required
    TileGame.Game = function (videoElement, numberOfRows) {
        var that = this;
        this.hasWon = false;
        this.numberOfRows = numberOfRows;

        // Setup dom elements
        var canvasWrapper = document.createElement('div');
        var display = document.createElement('canvas');
        canvasWrapper.appendChild(display);
        videoElement.parentNode.insertBefore(canvasWrapper, videoElement.nextSibling);
        videoElement.style.display = "none";

        this.context = display.getContext('2d');

        // Setup back buffer
        var back = document.createElement('canvas');
        this.backcontext = back.getContext('2d');

        // Initialize on 'play' of the video
        videoElement.addEventListener('play', function ()
        {
            // Set sizes to ensure proportional canvas at same size as the video source
            that.width = back.width = display.width = videoElement.videoWidth;
            that.height = back.height = display.height = videoElement.videoHeight;
            display.style.width = "100%";
            canvasWrapper.style.width = videoElement.width + 'px';
            canvasWrapper.style.height = videoElement.height + 'px';

            // Setup board
            that.slots = new Array(that.numberOfRows * that.numberOfRows);
            that.tiles = new Array(that.slots.length - 1);
            
            var numberOfTiles = that.tiles.length;
            var tileWidth = that.width / that.numberOfRows;
            var tileHeight = that.height / that.numberOfRows;

            for (var tile = 0; tile < that.tiles.length; tile++)
            {
                var pixelX = ((tile % that.numberOfRows) * tileWidth);
                var pixelY = Math.floor(tile / that.numberOfRows) * tileHeight;

                that.tiles[tile] = new TileGame.Tile(that.backcontext, that.context, tile, pixelX, pixelY, tileWidth, tileHeight);
            }

            var shuffledTiles = that.tiles.slice(0);//.shuffle();

            for (var slot = 0; slot < that.slots.length; slot++)
            {
                var newSlot = new TileGame.Slot(that.context);
                newSlot.boardX = (slot % that.numberOfRows);
                newSlot.boardY = Math.floor(slot / that.numberOfRows);
                newSlot.pixelX = newSlot.boardX * tileWidth;
                newSlot.pixelY = newSlot.boardY * tileHeight;
                newSlot.width = tileWidth;
                newSlot.height = tileHeight;
                newSlot.tile = shuffledTiles[slot];
                that.slots[slot] = newSlot;
            }

            that.videoElement = videoElement;
            that.draw();
        }, false);

        // Pass clicks of the canvas through to the slots
        display.addEventListener('click', function (e)
        {
            for (var slot = 0; slot < that.slots.length; slot++)
            {
                var scaledX = (videoElement.videoWidth / e.srcElement.clientWidth) * e.layerX;
                var scaledY = (videoElement.videoHeight / e.srcElement.clientHeight) * e.layerY;
                if (that.slots[slot].hitTest(scaledX, scaledY) && that.canMove(that.slots[slot]))
                {
                    var emptySlot = that.getEmptySlot();
                    emptySlot.tile = that.slots[slot].tile;
                    that.slots[slot].tile = undefined;
                }
            }

            // If the player has already won consider the next click as a game reset
            if (that.hasWon)
            {
                that.reset();
                that.hasWon = false;
            }

            that.checkWinCondition();
        });

        return this;
    };

    // Resets the game by randomizing the tiles and clearing the win flag
    TileGame.Game.prototype.reset = function ()
    {
        var shuffledTiles = this.tiles.slice(0).shuffle();

        for (var slot = 0; slot < this.slots.length; slot++)
        {
            this.slots[slot].tile = shuffledTiles[slot];
        }

        this.hasWon = false;
    }

    // Gets the current 'gap' in the image
    TileGame.Game.prototype.getEmptySlot = function ()
    {
        for (var possibleEmpty = 0; possibleEmpty < this.slots.length; possibleEmpty++)
        {
            if (!this.slots[possibleEmpty].tile)
            {
                return this.slots[possibleEmpty];
            }
        }

        return undefined;
    }

    // Returns a value indicating whether the tile in this slot can be moved
    TileGame.Game.prototype.canMove = function (slot)
    {
        var emptySlot = this.getEmptySlot();
        return !this.hasWon && ((Math.abs(slot.boardX - emptySlot.boardX) <= 1 && slot.boardY == emptySlot.boardY)
            || (slot.boardX == emptySlot.boardX && Math.abs(slot.boardY - emptySlot.boardY) <= 1));
    }

    // Draws the game in it's current state
    TileGame.Game.prototype.draw = function ()
    {
        if (this.videoElement.paused || this.videoElement.ended) {
            return false;
        }

        // First, draw it into the backing canvas
        this.context.clearRect(0, 0, this.width, this.height);
        this.backcontext.drawImage(this.videoElement, 0, 0, this.width, this.height);

        for (var i = 0; i < this.slots.length; i++) {
            this.slots[i].draw();
        }

        if (this.hasWon)
        {
            this.context.font = "40pt Arial, Helvetica";
            this.context.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.context.fillRect(0, 0, this.width, this.height);
            this.context.fillStyle = "#FFFFFF";
            this.context.fillText("Winner!", (this.width / 2) - 90 + 2, (this.height / 2) + 2);
            this.context.fillStyle = "#DD2222"
            this.context.fillText("Winner!", (this.width / 2) - 90, this.height / 2);
        }

        window.requestAnimationFrame(this.draw.bind(this));
    }

    // Checks if we have a winner yet by comparing slot order to tile source order
    TileGame.Game.prototype.checkWinCondition = function () {
        for (var slot = 0; slot < this.slots.length - 1; slot++) {
            if (this.slots[slot].tile != this.tiles[slot]) {
                return false;
            }
        }
        this.hasWon = true;
    }

    return TileGame;
}());