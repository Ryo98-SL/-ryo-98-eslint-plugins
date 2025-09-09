import {useState, useRef, useEffect} from "react";
import {Modal} from "../../../../share-comps/modal.tsx";

const width = '1px';
const size = 10;
const mock = '33';

function NoInlineLiteralObject(props: { text: string }) {
    const [backgroundColor, setBackgroundColor] = useState('#000');

    const {z2: _width} = { z2: 2};
    console.log('width', width);
    return <div style={{height: '3px', backgroundColor, width: _width}}>
        <Box style={{width: _width}}></Box>
        <Modal info={{size: 10}}
               onClick={({count}) => {
                   console.log(props.text);
            console.log("=>(in.tsx:17) count", count);
        }}/>
        <div style={{width}}></div>
    </div>
}

type StyleType = React.CSSProperties;

function Box(props: { style?: StyleType }) {
    return <div style={props.style}>box</div>
}