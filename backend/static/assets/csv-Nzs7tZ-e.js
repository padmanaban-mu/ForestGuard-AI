import{c,ak as s}from"./index-ymNQmQdf.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=c("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);function d(e,o="forestguard-export.csv"){if(!Array.isArray(e)||!e.length)return!1;const a=s.unparse(e,{quotes:!0,newline:`\r
`}),r=new Blob([`\uFEFF${a}`],{type:"text/csv;charset=utf-8;"}),n=URL.createObjectURL(r),t=document.createElement("a");return t.href=n,t.download=o,t.click(),URL.revokeObjectURL(n),!0}export{u as D,d};
