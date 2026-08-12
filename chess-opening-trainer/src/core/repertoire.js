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
      if(fullmove===1) return "c7c6";
      if(fullmove===2){
        const legal=chess.moves({verbose:true});
        if(legal.some(m=>m.from==="d7" && m.to==="d5")) return "d7d5";
      }
    }
  }catch{}
  return null;
}

export function isRequiredRepertoireMove(chess,side,uci){
  return repertoireAnchorForFen(chess,side)===uci;
}
