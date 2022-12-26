// import rtk from "@reduxjs/toolkit";
// import {createSelector} from "reselect";
//
// interface ZapSharedState {
//     port?: number
// }
//
// export const zapShared = rtk.createSlice({
//     name: "zap-shared",
//     initialState: {port: undefined} as ZapSharedState,
//     reducers: {
//         setPort: (state, action) => {
//             state.port = action.payload;
//         }
//     }
// });
//
// export const selectZapPort = createSelector(
//     (state: { zapShared: ZapSharedState }) => state.zapShared.port,
//     port => port
// );
//
// export const {setPort} = zapShared.actions;
