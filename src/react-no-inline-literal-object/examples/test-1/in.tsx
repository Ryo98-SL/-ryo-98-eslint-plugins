import {useState, useRef, useEffect} from "react";
import {Modal} from "./modal.tsx";

const width = '1px';
const size = 10;
const mock = '33';

function NoInlineLiteralObject() {
    const [backgroundColor, setBackgroundColor] = useState('#000');

    const {z2: _width} = { z2: 2};
    console.log('width', width);
    return <div style={{height: '3px', backgroundColor, width: _width}}>
        {/*<Box style={{width: _width}}></Box>*/}
        <Modal info={{size: 10}} />
        {/*<div style={{width}}></div>*/}
    </div>
}


function Box(props: { style?: React.CSSProperties }) {
    return <div style={props.style}>box</div>
}