export const REPERTOIRE_MOVES={
  white:[
    ["g1","f3"],["c1","f4"],["e2","e3"],["c2","c3"],["b1","d2"],["f1","d3"],
    ["h2","h3"],["e1","g1"],["d1","e2"],["f3","e5"],["b2","b3"],["a2","a4"],
    ["f1","e1"],["a1","d1"],["e3","e4"],["c3","c4"]
  ],
  black:[
    ["c8","f5"],["g8","f6"],["e7","e6"],["b8","d7"],["f8","e7"],["f8","d6"],
    ["e8","g8"],["d8","c7"],["h7","h6"],["a7","a6"],["b7","b5"],["f6","e4"],
    ["c6","c5"],["e6","e5"],["a8","c8"],["f8","e8"]
  ]
};

export function repertoireAnchorForFen(chess,side){
  try{
    const fen=chess.fen();
    const parts=fen.split(" ");
    const turn=parts[1];
    const fullmove=Number(parts[5]||1);

    if(side==="white"){
      if(turn==="w" && fullmove===1) return "d2d4";
      return null;
    }

    if(side==="black" && turn==="b"){
      const history=chess.history({verbose:true})||[];
      const blackMoves=history.filter(m=>m.color==="b");
      const whiteMoves=history.filter(m=>m.color==="w");
      const firstWhite=whiteMoves[0];
      const whitePlayedE4=whiteMoves.some(m=>m.from==="e2"&&m.to==="e4");
      const blackPlayedC6=blackMoves.some(m=>m.from==="c7"&&m.to==="c6");
      const blackPlayedD5=blackMoves.some(m=>m.from==="d7"&&m.to==="d5");

      // Opening-family lock (Reports #15/#16/#17):
      // 1.e4 enters Caro-Kann with ...c6. Queen-pawn / flank starts enter
      // a Slav shell with ...d5. The complementary pawn move follows next.
      // This is position-aware rather than blindly forcing the same move against
      // every White first move, and it keeps the requested repertoire identity stable.
      if(blackMoves.length===0){
        if(firstWhite?.from==="e2"&&firstWhite?.to==="e4") return "c7c6";
        return "d7d5";
      }
      if(blackMoves.length===1){
        if(blackPlayedC6 && !blackPlayedD5) return "d7d5";
        if(blackPlayedD5 && !blackPlayedC6 && !whitePlayedE4) return "c7c6";
      }
    }
  }catch{}
  return null;
}

export function isRequiredRepertoireMove(chess,side,uci){
  return repertoireAnchorForFen(chess,side)===uci;
}
