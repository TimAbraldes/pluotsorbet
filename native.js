/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim: set shiftwidth=4 tabstop=4 autoindent cindent expandtab: */

'Use strict';

var Native = {};

Native.invoke = function(caller, methodInfo, callback) {
    function pushType(type, value) {
        if (type === "long" || type === "double") {
            caller.stack.push2(value);
            return;
        }
        caller.stack.push(value);
    }

    function popType(type) {
        return (type === "long" || type === "double") ? caller.stack.pop2() : caller.stack.pop();
    }

    function popArgs(types) {
        var argc = types.length;
        if (!ACCESS_FLAGS.isStatic(methodInfo.access_flags))
            ++argc;
        var args = Array(argc);
        for (var i=types.length-1, j=args.length-1; i >= 0; --i, --j)
            args[j] = popType(types[i].type);
        if (j >= 0)
            args[0] = caller.stack.pop();
        return args;
    }

    var signature = Signature.parse(methodInfo.signature);
    var args = popArgs(signature.IN);
    if (!methodInfo.native) {
        var key = methodInfo.classInfo.className + "." + methodInfo.name + "." + methodInfo.signature;
        methodInfo.native = Native.fast[key];
    }
    var result = methodInfo.native.apply(caller, args);
    if (signature.OUT.length)
        pushType(signature.OUT[0].type, result);
    return true;
}

Native.fast = {};

Native.fast["java/lang/System.arraycopy.(Ljava/lang/Object;ILjava/lang/Object;II)V"] = function(src, srcOffset, dst, dstOffset, length) {
    var frame = this;
    if (!src || !dst) {
        throw CLASSES.newException(frame.getThread(), "java/lang/NullPointerException", "Cannot copy to/from a null array.");
        return;
    }
    var srcClass = src.class;
    var dstClass = dst.class;
    if (!srcClass.isArrayClass || !dstClass.isArrayClass) {
        throw CLASSES.newException(frame.getThread(), "java/lang/ArrayStoreException", "Can only copy to/from array types.");
        return;
    }
    if (srcClass != dstClass && (!srcClass.elementClass || !dstClass.elementClass || !srcClass.elementClass.isAssignableTo(dstClass.elementClass))) {
        throw CLASSES.newException(frame.getThread(), "java/lang/ArrayStoreException", "Incompatible component types.");
        return;
    }
    if (srcOffset < 0 || (srcOffset+length) > src.length || dstOffset < 0 || (dstOffset+length) > dst.length || length < 0) {
        throw CLASSES.newException(frame.getThread(), "java/lang/ArrayIndexOutOfBoundsException", "Invalid index.");
        return;
    }
    if (dst !== src || dstOffset < srcOffset) {
        for (var n = 0; n < length; ++n)
            dst[dstOffset++] = src[srcOffset++];
    } else {
        dstOffset += length;
        srcOffset += length;
        for (var n = 0; n < length; ++n)
            dst[--dstOffset] = src[--srcOffset];
    }
}

Native.fast["java/lang/System.getProperty0.(Ljava/lang/String;)Ljava/lang/String;"] = function(key) {
    switch (util.fromJavaString(key)) {
    case "microedition.encoding":
        return CLASSES.newString("UTF-8");
    }
    console.log("UNKNOWN PROPERTY: " + util.fromJavaString(key));
    return null;
}

Native.fast["java/lang/System.currentTimeMillis.()J"] = function() {
    return Long.fromNumber(Date.now());
}

Native.fast["com/sun/cldchi/jvm/JVM.unchecked_char_arraycopy.([CI[CII)V"] = function(src, srcOffset, dst, dstOffset, length) {
    if (dst !== src || dstOffset < srcOffset) {
        for (var n = 0; n < length; ++n)
            dst[dstOffset++] = src[srcOffset++];
    } else {
        dstOffset += length;
        srcOffset += length;
        for (var n = 0; n < length; ++n)
            dst[--dstOffset] = src[--srcOffset];
    }
}

Native.fast["java/lang/Object.getClass.()Ljava/lang/Class;"] = function(obj) {
    return obj.class.getClassObject();
}

Native.fast["java/lang/Class.getName.()Ljava/lang/String;"] = function(obj) {
    return util.cache(obj, "getName", function () {
        return CLASSES.newString(obj.vmClass.className.replace("/", ".", "g"));
    });
}

Native.fast["java/lang/Class.forName.(Ljava/lang/String;)Ljava/lang/Class;"] = function(name) {
    var className = util.fromJavaString(name).replace(".", "/", "g");
    var classInfo = (className[0] === "[") ? null : CLASSES.getClass(className);
    if (!classInfo) {
        throw new Native.VM.JavaException("java/lang/ClassNotFoundException", "'" + className + "' not found.");
    }
    return classInfo.getClassObject();
}

Native.fast["java/lang/Class.newInstance.()Ljava/lang/Object;"] = function(classObject) {
    var classInfo = classObject.vmClass;
    CLASSES.initClass(classInfo);
    var obj = new (classInfo.constructor)();
    VM.invokeConstructor(this.getThread(), obj);
    return obj;
};

Native.fast["java/lang/Class.isInterface.()Z"] = function(classObject) {
    var classInfo = classObject.vmClass;
    return ACCESS_FLAGS.isInterface(classInfo.access_flags) ? 1 : 0;
}

Native.fast["java/lang/Class.isArray.()Z"] = function(classObject) {
    var classInfo = classObject.vmClass;
    return classInfo.isArrayClass ? 1 : 0;
}

Native.fast["java/lang/Class.isAssignableFrom.(Ljava/lang/Class;)Z"] = function(classObject, fromClass) {
    if (!fromClass) {
        throw CLASSES.newException(frame.getThread(), "java/lang/NullPointerException");
        return;
    }
    return fromClass.vmClass.isAssignableTo(classObject.vmClass) ? 1 : 0;
}

Native.fast["java/lang/Class.isInstance.(Ljava/lang/Object;)Z"] = function(classObject, obj) {
    return obj && obj.class.isAssignableTo(classObject.vmClass) ? 1 : 0;
}

Native.fast["java/lang/Float.floatToIntBits.(F)I"] = (function() {
    var fa = Float32Array(1);
    var ia = Int32Array(fa.buffer);
    return function(f) {
        fa[0] = f;
        return ia[0];
    }
})();

Native.fast["java/lang/Double.doubleToLongBits.(D)J"] = (function() {
    var da = Float64Array(1);
    var ia = Int32Array(da.buffer);
    return function(d) {
        da[0] = d;
        return Long.fromBits(ia[0], ia[1]);
    }
})();

Native.fast["java/lang/Float.intBitsToFloat.(I)F"] = (function() {
    var fa = Float32Array(1);
    var ia = Int32Array(fa.buffer);
    return function(i) {
        ia[0] = i;
        return fa[0];
    }
})();

Native.fast["java/lang/Double.longBitsToDouble.(J)D"] = (function() {
    var da = Float64Array(1);
    var ia = Int32Array(da.buffer);
    return function(l) {
        ia[0] = l.low_;
        ia[1] = l.high_;
        return da[0];
    }
})();

Native.fast["java/lang/Throwable.fillInStackTrace.()V"] = (function() {
});

Native.fast["java/lang/Throwable.obtainBackTrace.()Ljava/lang/Object;"] = (function() {
    return null;
});

Native.fast["java/lang/Runtime.freeMemory.()J"] = function() {
    return Long.fromInt(0x800000);
}

Native.fast["java/lang/Runtime.totalMemory.()J"] = function() {
    return Long.fromInt(0x1000000);
}

Native.fast["java/lang/Runtime.gc.()V"] = function() {
}

Native.fast["java/lang/Math.floor.(D)D"] = function(d) {
    return Math.floor(d);
}

Native.fast["java/lang/Thread.currentThread.()Ljava/lang/Thread;"] = function() {
    return this.getThread();
}

Native.fast["java/lang/Thread.setPriority0.(II)V"] = function(thread, oldPriority, newPriority) {
}

Native.fast["java/lang/Thread.start0.()V"] = function(thread) {
    // The main thread starts during bootstrap and don't allow calling start()
    // on already running threads.
    if (thread === CLASSES.mainThread || thread.running)
        throw CLASSES.newException(frame.getThread(), "java/lang/IllegalThreadStateException");
    thread.running = true;
    var run = CLASSES.getMethod(thread.class, "run", "()V", false, true);
    window.setZeroTimeout(function () {
        VM.invoke(thread, run, [thread]);
    });
}

Native.fast["com/sun/cldchi/io/ConsoleOutputStream.write.(I)V"] = (function() {
    var s = "";
    return function(obj, ch) {
        if (ch === 10) {
            document.getElementById("output").textContent += s + "\n";
            s = "";
            return;
        }
        s += String.fromCharCode(ch);
    }
})();

Native.fast["com/sun/cldc/io/ResourceInputStream.open.(Ljava/lang/String;)Ljava/lang/Object;"] = function(name) {
    var fileName = util.fromJavaString(name);
    var data = CLASSES.loadFile(fileName);
    if (!data)
        return null;
    var obj = CLASSES.newObject(CLASSES.java_lang_Object);
    obj.data = Uint8Array(data);
    obj.pos = 0;
    return obj;
};

Native.fast["com/sun/cldc/io/ResourceInputStream.bytesRemain.(Ljava/lang/Object;)I"] = function(handle) {
    return handle.data.length - handle.pos;
}

Native.fast["com/sun/cldc/io/ResourceInputStream.readByte.(Ljava/lang/Object;)I"] = function(handle) {
    return handle.data[handle.pos++];
}

Native.fast["com/sun/cldc/io/ResourceInputStream.readBytes.(Ljava/lang/Object;[BII)I"] = function(handle, b, off, len) {
    var data = handle.data;
    var remaining = data.length - handle.pos;
    if (remaining > len)
        len = remaining;
    for (var n = 0; n < len; ++n)
        b[off+n] = data[n];
    handle.pos += len;
    return len;
}

Native.fast["com/sun/cldc/i18n/uclc/DefaultCaseConverter.toLowerCase.(C)C"] = function(c) {
    return String.fromCharCode(c).toLowerCase().charCodeAt(0);
}

Native.fast["com/sun/cldc/i18n/uclc/DefaultCaseConverter.toUpperCase.(C)C"] = function(c) {
    return String.fromCharCode(c).toUpperCase().charCodeAt(0);
}
