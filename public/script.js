const socket=io();

const chess=new Chess();

const boardElement = document.querySelector(".chessboard");

let draggedPiece=null;
let sourceSquare=null;
let playerRole=null;

const renderBoard=()=>{
    const board=chess.board();
    boardElement.innerHTML="";

    board.forEach((row,rowindex) => {
        row.forEach((square,squareindex)=>{
            const squareElement=document.createElement("div");
            squareElement.classList.add("square",
            (rowindex+squareindex)%2===0 ? "light":"dark"
        );
        squareElement.dataset.row=rowindex;
        squareElement.dataset.col=squareindex;

        if(square){
            const pieceElement = document.createElement("img");
            pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
            pieceElement.src = getPieceImagePath(square);
            pieceElement.draggable = playerRole === square.color;
            if (boardElement.classList.contains("flipped")) {
                pieceElement.classList.add("flipped");
            }

            console.log(`Piece at ${rowindex},${squareindex} - Type: ${square.type}, Color: ${square.color}, Src: ${pieceElement.src}`);

            pieceElement.addEventListener("dragstart",(e)=>{
                console.log('Drag start');
                if(pieceElement.draggable){
                    draggedPiece=pieceElement;
                    sourceSquare={row:rowindex,col:squareindex};
                    e.dataTransfer.setData("text/plain","");
                }
            });

            pieceElement.addEventListener("dragend",(e)=>{
                draggedPiece=null;
                sourceSquare=null;
            });
            squareElement.appendChild(pieceElement);
        }

        squareElement.addEventListener("dragover",function (e){
            e.preventDefault();
        });
        squareElement.addEventListener("drop",function (e){
            e.preventDefault();
            if(draggedPiece){
                const targetSource={
                    row:parseInt(squareElement.dataset.row),
                    col:parseInt(squareElement.dataset.col)
                };

                handleMove(sourceSquare,targetSource)
            }

        });
        boardElement.appendChild(squareElement);
        });
        
    });
    
    if (playerRole === 'b') {
        boardElement.classList.add('flipped');
    } else {
        boardElement.classList.remove('flipped');
    }
};

const handleMove=(source,target)=>{
    const move={
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
    };
    const piece = chess.get(move.from);
    if (piece.type === 'p' && (target.row === 0 || target.row === 7)) {
        move.promotion = 'q';  // Automatically promote to a queen 
    }

    socket.emit("move",move);
};

const getPieceImagePath = (piece) => {
    const pieceImages = {
        b: {
            p: "images/black_pawn.svg",
            r: "images/black_rook.svg",
            n: "images/black_knight.svg",
            b: "images/black_bishop.svg",
            q: "images/black_queen.svg",
            k: "images/black_king.svg"
        },
        w: {
            p: "images/white_pawn.svg",
            r: "images/white_rook.svg",
            n: "images/white_knight.svg",
            b: "images/white_bishop.svg",
            q: "images/white_queen.svg",
            k: "images/white_king.svg"
        }
    };
    return pieceImages[piece.color][piece.type] || "";
};

const displayMessage = (message,type = 'info') => {
    const messageBox = document.getElementById('messageBox');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    
    messageElement.classList.add('message', type);
    messageBox.appendChild(messageElement);
    if (type === 'error') {
        setTimeout(() => {
            messageBox.removeChild(messageElement);
        }, 5000); 
    }
};

socket.on('invalidMove', (move) => {
    displayMessage('Invalid move', 'error');
});

socket.on('message', (message) => {
    displayMessage(message,'info');
});

socket.on("playerRole", function (role) {
    playerRole = role;
    console.log(`Player role set to: ${playerRole}`);
    renderBoard();
});

socket.on("opponentJoined", function (opponentName) {
    const message = `You are playing against ${opponentName}`;
    displayMessage(message,'info');
});

socket.on("spectatorRole", function () {
    playerRole = null;
    displayMessage('Joined as spectator','info');
    renderBoard()
});

socket.on("boardState",function(fen){
    chess.load(fen);
    renderBoard()
});
socket.on("move",function(move){
    chess.move(move);
    renderBoard()
});

const joinGame = (gameId, userName) => {
    socket.emit('joinGame', gameId, userName);
};

document.getElementById('joinGameButton').addEventListener('click', () => {
    const gameId = document.getElementById('gameIdInput').value;
    const userName = document.getElementById('userNameInput').value;
    joinGame(gameId, userName);
});


renderBoard();