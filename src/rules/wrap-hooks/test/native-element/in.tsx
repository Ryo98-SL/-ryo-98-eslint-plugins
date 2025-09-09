import {useState, useRef, useEffect} from "react";


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
    return <div style={{
        height: '3px',
        backgroundColor,
        width: _width,
        fontSize: props.fontSize,
        lineHeight: styles.lineHeight,
        color: styles.nest[props.fontSize == '1' ? 'value' : 'value2'],
        scale: styles.nest.value,
        borderColor: styles.nest.value,
    }}
                onClick={() => {
                    const info = {
                        data: '123123'
                    };

                    console.log('=> info', info.data, fontSize);
                }}
    >
    </div>
}