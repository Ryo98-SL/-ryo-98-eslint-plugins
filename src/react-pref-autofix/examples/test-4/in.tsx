import ListDataArrayAlias, {Modal} from "../modal.tsx";
import {useCallback, useState} from "react";


function Test4() {

    const [size, setSize] = useState(10)

    const innerGenList = useCallback(() => {
        return [
            {
                id: 'asd',
                message: 'hello'
            }
        ]
    }, []);

    const innerGenInfo = useCallback((size: number) => {
        return {
            size: size + 20
        }
    }, []);

    return <>

        <Modal list={genList()}
               info={genInfo(size)}
        />

        <Modal list={innerGenList()}
               info={innerGenInfo(size)}
        />


        <Modal info={new InfoFactory(30)}
               list={new ListFactory({id: '23', message: size + ''}).list}
               pattern={new RegExp('^[a-z]','g')}
        />
    </>
}

class ListFactory {
    list: ListDataArrayAlias = [];
    constructor(item: {id: string, message: string}) {
        this.list.push(item)
    }
}

class InfoFactory {
    size: number;

    constructor(size: number) {
        this.size = size + 10;
    }
}

function genList() {
    return [
        {
            id: 'asd',
            message: 'hello'
        }
    ]
}

function genInfo(size: number) {
    return {
        size
    }
}