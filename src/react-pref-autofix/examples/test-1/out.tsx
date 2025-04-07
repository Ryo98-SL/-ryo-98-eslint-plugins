import { useCallback, CSSProperties, useState, useRef, useEffect, useMemo } from "react";
import { ModalInfoType, OnClickType, Modal } from "./../modal.tsx";

const width = '1px';
const size = 10;
const mock = '33';

function NoInlineLiteralObject() {
    const [backgroundColor, setBackgroundColor] = useState('#000');

    const {z2: _width} = { z2: 2};
    
    const boxStyle = useMemo<CSSProperties | undefined>(() => { return { width: _width }; }, [_width]);
    
    const handleModalClick = useCallback<OnClickType>(({ count }) => {
        console.log("=>(in.tsx:17) count", count);
    }, []);
    console.log('width', width);
    return <div style={{height: '3px', backgroundColor, width: _width}}>
        <Box style={boxStyle}></Box>
        <Modal info={ModalInfo}
               onClick={handleModalClick}/>
        <div style={{width}}></div>
    </div>
}

type StyleType = React.CSSProperties;

function Box(props: { style?: StyleType }) {
    return <div style={props.style}>box</div>
}
const ModalInfo: ModalInfoType | undefined = { size: 10 };
