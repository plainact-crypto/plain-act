import { Chess } from "chess.js";

export function createInitialState(){
  return {
    screen:"side", side:null, sessionLength:5, mode:"guided",
    chess:new Chess(), board:null, guideMove:null,
    userMovesDone:0, mistakes:0, history:[],
    status:"", statusError:false, complete:false,
    evalCp:0, evalMate:null, evalDepth:0, evalPv:"",
    briefing:null, briefingTimer:null, openingLabel:"", openingEco:"",
    trainingLine:[], testCursor:0, hintVisible:false, guidedCompleted:false,
    profileEmail:"", profileLoaded:false,

    courseLoading:false, courseMessage:"",
    variationIndex:0, currentFirstMove:null, variationFirstPending:false,
    practiceHintUsed:false, practiceInvalid:false,

    rankRound:0, rankRounds:[], rankFresh:false, rankLosses:[],
    rankSavedLosses:[], rankFreshLosses:[], rankBeforeScore:null,
    rankBestMove:null, rankSummary:null, rankFreshBranchPending:false,

    savedReplay:false, savedReplayLine:null, savedReplayCursor:0,
    selectedLineIndex:0, moveQuality:null, moveQualityTimer:null,

    rankPendingReview:null, rankReviewItems:[], rankReviewIndex:0,
    rankReviewPly:0, rankReviewPlaying:false, rankReviewTimer:null,

    branchAvoidUci:new Set()
  };
}
