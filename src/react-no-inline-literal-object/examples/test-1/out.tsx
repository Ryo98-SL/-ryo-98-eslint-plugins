import { CSSProperties, useState, useRef, useEffect, useMemo } from "react";
import {Modal} from "./modal.tsx";
import { ModalInfoType } from "modal.tsx";

const width = '1px';
const size = 10;
const mock = '33';

function NoInlineLiteralObject() {
    const [backgroundColor, setBackgroundColor] = useState('#000');

    const {z2: _width} = { z2: 2};

    const divStyle = useMemo<CSSProperties | undefined>(() => {
      return {
        height: '3px',
        backgroundColor,
        width: _width
    };
    },[backgroundColor,_width]);
        console.log('width', width);
    return <div style={divStyle}>
        {/*<Box style={{width: _width}}></Box>*/}
        <Modal info={ModalInfo} />
        {/*<div style={{width}}></div>*/}
    </div>
}


function Box(props: { style?: React.CSSProperties }) {
    return <div style={props.style}>box</div>
}
const ModalInfo : ModalInfoType = { size: 10 };
