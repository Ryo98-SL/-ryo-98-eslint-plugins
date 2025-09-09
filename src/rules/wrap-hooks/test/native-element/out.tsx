import { MouseEventHandler, CSSProperties, useState, useRef, useEffect, useMemo, useCallback } from "react";


function NoInlineLiteralObject(props: { fontSize: string }) {
    const [backgroundColor, setBackgroundColor] = useState('#000');
    const { fontSize } = props;
    const styles = {
        lineHeight: "inherit",
        nest: {
            value: 'inherit',
            value2: 'unset',
        }
    }

    const {z2: _width} = { z2: 2};
    
    const divStyle = useMemo<CSSProperties | undefined>(() => { return {
        height: '3px',
        backgroundColor,
        width: _width,
        // fontSize: props.fontSize,
        lineHeight: styles.lineHeight,
        // color: styles.nest[props.fontSize == '1' ? 'value' : 'value2'],
        scale: styles.nest.value,
        borderColor: styles.nest.value,
    }; }, [backgroundColor, _width, styles.lineHeight, styles, styles.nest.value, styles.nest]);
    
    const handleDivClick = useCallback<MouseEventHandler<HTMLDivElement>>(() => {
        const info = {
            data: '123123'
        };
        console.log('=> info', info.data, fontSize);
    }, [fontSize]);
    return <div style={divStyle}
                onClick={handleDivClick}
    >
    </div>
}